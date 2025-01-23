# Hello World for  policies with DynamoDB

## Setup

1) Deploy the environment.  If you are not familiar with CDK please see the [Getting Started](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
``` bash
deploy cdk
```
2) Create test data to the Policy table - I did it manually through the web console to have something that looks like the following 

| tenantId (String) | id (String) |
|-------------------|-------------|
| tenant1           | policy1     |
| tenant2           | policy2     |
| tenant3           | policy3     |
| tenant1           | policy4     |
3) Start the web app
``` bash
npm run dev
```
4) Create at least user in the "Create Account" tab.  If you use gmail [see this link](https://gmail.googleblog.com/2008/03/2-hidden-ways-to-get-more-from-your.html) for creating multiple email addresses; yes, you will have problems at this point - do not panic.  The screen says "failed to load" because it is working, you do not have a populated customer attribute that has the value of your tenant.  Press the "Sign Out" button.
5) Either in the Cognito console or CLI add a "User attribute" to the user your have created.  The attribute is 'custom:tenantId' and set the value to be 'tenant1'
6) In the web app Sign In with your modified user.  If you created the test data like table shows then you should see two records that show policy1 and policy4




