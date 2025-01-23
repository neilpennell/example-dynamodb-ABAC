import * as cdk from 'aws-cdk-lib';
import {CfnOutput, RemovalPolicy} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {join} from "path";
import {AmplifyAuth} from "@aws-amplify/auth-construct";
import {AuthorizationType, CognitoUserPoolsAuthorizer, LambdaIntegration, RestApi} from "aws-cdk-lib/aws-apigateway";
import {AttributeType, Billing, TableV2} from "aws-cdk-lib/aws-dynamodb";
import {NodejsFunction, NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import {Architecture, Runtime, RuntimeManagementMode} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {Certificate} from "aws-cdk-lib/aws-certificatemanager";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {ApiGateway} from 'aws-cdk-lib/aws-route53-targets';
import {ArnPrincipal, Effect, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";

const STAGE = "v1";
const BASEPATH = 'v1';
const TOP_DOMAIN = 'hensgroup.info';
const SUB_DOMAIN = 'policy';
const POLICY_LAMBDA_LOCATION = 'lambdas';


export class PoliciesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==============================================
    // ===
    // ===  C O G N I T O
    // ===
    // ==============================================

    const auth = new AmplifyAuth(this, 'AuthPolicy', {
      name: "policiesStack",
      loginWith: {email: true,},
      // in a production environment mutable should be false
      // as you would have code to set this properly during user creation
      userAttributes: {'custom:tenantId': {mutable: true, dataType: 'String'}},
    });

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'crudPolicyAuthorizer', {
      cognitoUserPools: [auth.resources.userPool]
    });


    // ==============================================
    // ===
    // ===  Policy Table
    // ===
    // ==============================================

    const POLICIES_PARTITION_KEY = 'tenantId';
    const POLICIES_SORT_KEY = 'id';
    const policyTable = new TableV2(this, 'policiesTable', {
      tableName: 'Policies',
      partitionKey: {name: POLICIES_PARTITION_KEY, type: AttributeType.STRING},
      sortKey: {name: POLICIES_SORT_KEY, type: AttributeType.STRING},
      billing: Billing.onDemand(),
      contributorInsights: true,
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    // ==============================================
    // ===
    // ===  Rest API Gateway
    // ===
    // ==============================================

    const domainCert = Certificate.fromCertificateArn(
        this,
        'domainCert',
        'arn:aws:acm:us-east-2:911661353157:certificate/adf90e4a-7533-4fe8-afda-c78105010c7a' // *.hensgroup.info
    );
    const crudAPI = new RestApi(this, 'crudPolicyApi', {
      restApiName: 'Policy CRUD Service',
      description: 'This is for Testing out ideas on how to implement ABAC on DynamoDB',
      deploy: true,
      cloudWatchRoleRemovalPolicy: RemovalPolicy.DESTROY,
      cloudWatchRole: true,
      retainDeployments: false,
      deployOptions: {
        stageName: STAGE,
      },
      domainName: {
        domainName: `${SUB_DOMAIN}.${TOP_DOMAIN}`,
        certificate: domainCert,
        basePath: BASEPATH,
      },
    });

    // TODO: certificate pre-created - need to figure out how to do this within CDK
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z10050741RW6K175NL39G',
      zoneName: TOP_DOMAIN,
    });

    const aRecord = new ARecord(this, 'ARecord', {
      deleteExisting: true,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new ApiGateway(crudAPI)),
      recordName: SUB_DOMAIN,
    });

    // ==============================================
    // ===
    // ===  CRUD Policy
    // ===
    // ==============================================

    const policyFunctionProps: NodejsFunctionProps = {
      depsLockFilePath: join(__dirname, POLICY_LAMBDA_LOCATION, 'package-lock.json'),
      environment: {
        SORT_KEY: POLICIES_SORT_KEY,
        PRIMARY_KEY: POLICIES_PARTITION_KEY,
        TABLE_NAME: policyTable.tableName,
      },
      runtime: Runtime.NODEJS_22_X,
      runtimeManagementMode: RuntimeManagementMode.AUTO,
      memorySize: 128,
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.THREE_DAYS,
    }

    const getAllLambda_Policy = new NodejsFunction(this, 'getAllFunction_Policy', {
      entry: join(__dirname, POLICY_LAMBDA_LOCATION, 'get-all.ts'),
      ...policyFunctionProps,
    });
    const createOneLambda_Policy = new NodejsFunction(this, 'createFunction_Policy', {
      entry: join(__dirname, POLICY_LAMBDA_LOCATION, 'create.ts'),
      ...policyFunctionProps,
    });

    policyTable.grantReadData(getAllLambda_Policy.grantPrincipal);
    policyTable.grantWriteData(createOneLambda_Policy.grantPrincipal);

    this.abacRoleFor('abacRole', getAllLambda_Policy, policyTable);
    this.abacRoleFor('abacRole-2', createOneLambda_Policy, policyTable);

    const policies = crudAPI.root.addResource('policies');

    const getMethod = policies.addMethod('GET', new LambdaIntegration(getAllLambda_Policy), {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: authorizer,
      operationName: "getProfiles",
    });

    const postMethod = policies.addMethod('POST', new LambdaIntegration(createOneLambda_Policy), {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: authorizer,
      operationName: "postMethod",
    });

    policies.addCorsPreflight({
      allowOrigins: ['*'],
    })

    new CfnOutput(this, 'urlForApiGateway', {
      value: `https://${SUB_DOMAIN}.${TOP_DOMAIN}/${BASEPATH}`,
      description: 'CRUD API ID'
    });

  }

  private abacRoleFor(roleName: string, fn: NodejsFunction, table: TableV2) {
    const abacRole = new Role(this, roleName, {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    abacRole.assumeRolePolicy?.addStatements(
        new PolicyStatement({
          actions: ["sts:AssumeRole", "sts:TagSession"],
          effect: Effect.ALLOW,
          principals: [new ArnPrincipal(<string>fn.role?.roleArn)],
          conditions: {
            StringLike: {
              "aws:RequestTag/TenantId": "*",
            },
          },
        }),
    );

    abacRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "dynamodb:UpdateItem",
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:DeleteItem",
            "dynamodb:Query",
          ],
          resources: [table.tableArn],
          conditions: {
            "ForAllValues:StringEquals": {
              "dynamodb:LeadingKeys": ["${aws:PrincipalTag/TenantId}"],
            },
          },
        }),
    );

    fn.addEnvironment("REQUEST_TAG_KEYS_MAPPING_ATTRIBUTES", '{"TenantId":"custom:tenantId"}');
    fn.addEnvironment("IAM_ROLE_ARN", abacRole.roleArn)
  }

}
