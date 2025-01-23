#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PoliciesStack } from '../lib/policies-stack';

const app = new cdk.App();
new PoliciesStack(app, 'PoliciesStack', {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
  }
});