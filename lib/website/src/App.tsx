import {useEffect, useState} from 'react'

import axios, {AxiosResponse} from "axios";
import {AuthSession, fetchAuthSession} from "aws-amplify/auth";
import {
  Alert,
  Button,
  Card,
  Collection,
  Heading,
  Loader,
  Text,
  useAuthenticator,
  View,
  withAuthenticator
} from '@aws-amplify/ui-react';

import './App.css'
import {Amplify} from "aws-amplify";
import '@aws-amplify/ui-react/styles.css'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-2_aYtEe0LbD",
      userPoolClientId: "5pm5arpqs7312fqfcf3i5isajr",
      identityPoolId: "us-east-2:60d54898-8e35-40e4-ad2e-bf0ac002caf3",
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: "code",
      userAttributes: {
        email: {required: true,},
      },
      allowGuestAccess: true,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
});


class PolicyRecord {
  tenantId: string = "UNKNOWN TENANT";
  id: string = "UNKNOWN ID";
}

function App() {
  const [isLoading, setLoading] = useState(true)
  const {user, signOut} = useAuthenticator((context) => [context.user]);
  // @ts-ignore
  const [url, setUrl] = useState<string>("https://policy.hensgroup.info/v1/policies");
  const [records, setRecords] = useState<PolicyRecord[]>([]);
  const [errorOccurred, setErrorOccurred] = useState<boolean>(false);
  // @ts-ignore
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  // setUrl("https://policy.hensgroup.info/v1");

  useEffect(() => {
    setLoading(true);

    fetchAuthSession()
        .then((session: AuthSession) => {
          const headers = {
            "Authorization": "NeedToBeFilledIn",
            "Content-Type": "application/json"
          };
          setAuthSession(session);
          headers["Authorization"] = session.tokens?.idToken?.toString() || "";
          axios.get(url, {headers: headers})
              .then((rsp: AxiosResponse) => {
                setRecords(rsp.data);
              })
              .catch((e) => {
                setErrorOccurred(true);
                console.error(`Axios error ${url}`, e)
              })
              .finally(() => {
                setLoading(false);
              });
        })

    return () => {
      setLoading(false);
      setErrorOccurred(false);
    };
  }, []);

  if (errorOccurred) return (<><Alert>failed to load</Alert><Button onClick={signOut}>Sign Out</Button></>)
  if (isLoading) return (<Loader variation="linear"/>)
  return (
      <View>
        <Card>
          <Heading>Email: {user?.signInDetails?.loginId}</Heading>
          <br/>
          <Button onClick={signOut}>Sign Out</Button>
        </Card>
        <Heading>Policy Records</Heading>
        <Collection items={records} type={"list"}>
          {(item, index) => (
              <Card key={index} variation={"elevated"}>
                <Heading level={3}>{item.id}</Heading>
                <Text>{item.tenantId}</Text>
              </Card>
          )}
        </Collection>
      </View>
  )
}

// export default App
export default withAuthenticator(App);