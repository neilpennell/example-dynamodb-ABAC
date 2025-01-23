# Hello World for ABAC policies for DynamoDB

This is meant to show an end to end example of how to implement ABAC in DynamoDB.

This code does the following:
* Takes an attribute that is defined in the Cognito User (customer attribute) 
* Maps it into session attribute (sts:TagSession)
* uses a conditional statement in the role to constrain the access to the Items (conditions: {"ForAllValues:StringEquals": {"dynamodb:LeadingKeys": ["${aws:PrincipalTag/TenantId}"] })

To see how this works edit the file 'get-all.ts' and change the line
``` typescript
":tenant": getTenantId(event.headers.Authorization)
```
to be like the following
``` typescript
":tenant": "tenant2"
```
pay attention to make sure the value chosen for the tenant is different that what is specified in the users customer attribute.
you will see on the screen "failed to load" message on the screen, in the CloudWatch logs you will see dberror saying this action is blocked. 

**NOTE:**  "dynamodb:Scan" is removed from the authorized actions because it bypasses the role condition.



## Setup

1) Deploy the environment.  If you are not familiar with CDK please see the [Getting Started](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
``` shell
./deploy.sh ACCOUNT REGION
```
where ACCOUNT is your account number and REGION is the region to deploy to.

2) You will need to edit App.tsx and update the following 3 fields of the "Amplify.configure" parameters
``` typescript
         userPoolId: "", // value of PoliciesStack.userPoolId 
   userPoolClientId: "", // value of PoliciesStack.oauthClientId
     identityPoolId: "", // value of PoliciesStack.identityPoolId
```

3) You will need to edit the URL and replace it with the value from "PoliciesStack.crudPolicyApiEndpoint(random alphanumeric)"
``` typescript
const [url, setUrl] = useState<string>("< PoliciesStack.crudPolicyApiEndpoint... >/v1/policies");
```

4) Create test data to the Policy table - I did it manually through the web console to have something that looks like the following 

| tenantId (String) | id (String) |
|-------------------|-------------|
| tenant1           | policy1     |
| tenant2           | policy2     |
| tenant3           | policy3     |
| tenant1           | policy4     |

5) Start the web app
``` shell
npm install
npm run dev
```
Open your browser to the location specified on localhost

6) Create at least user in the "Create Account" tab.  If you use gmail [see this link](https://gmail.googleblog.com/2008/03/2-hidden-ways-to-get-more-from-your.html) for creating multiple email addresses; yes, you will have problems at this point - do not panic.  The screen says "failed to load" because it is working, you do not have a populated customer attribute that has the value of your tenant.  Press the "Sign Out" button.

7) Either in the Cognito console or CLI add a "User attribute" to the user your have created.  The attribute is 'custom:tenantId' and set the value to be 'tenant1'

8) In the web app Sign In with your modified user.  If you created the test data like table shows then you should see two records that show policy1 and policy4

9) clean up
``` shell
cdk destroy
```


