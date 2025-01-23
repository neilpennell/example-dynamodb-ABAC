import {DynamoDBDocument} from "@aws-sdk/lib-dynamodb";
import {DynamoDB} from "@aws-sdk/client-dynamodb";
import {fromTemporaryCredentials} from "@aws-sdk/credential-providers";

/**
 * Set this IAM_ROLE_ARN environment variable
 * with the abac iam role which needs to be assumed
 */

// process.env.IAM_ROLE_ARN = /* For example, set ARN of role which has above abacRolePolicy*/

/**
 * Set this REQUEST_TAG_KEYS_MAPPING_ATTRIBUTES environment variable
 * with mapping of variable name used in abacRolePolicy "TenantId"
 * to the attribute name("custom:tenantId") in the
 * inputJsonWebToken which has TenantId value as shown below
 */
// process.env.REQUEST_TAG_KEYS_MAPPING_ATTRIBUTES = '{"TenantId":"custom:tenantId"}';

export function getDynamoDbClient(authorization: string, region: string): DynamoDBDocument {

  const requestTagKeysMappingAttributes = JSON.parse(
      <string>process.env.REQUEST_TAG_KEYS_MAPPING_ATTRIBUTES,
  );
  const decodedToken = decodeJWT(authorization).payload;
  const requestTagKeyValueArray = createRequestTagKeyValueArray(
      requestTagKeysMappingAttributes,
      decodedToken,
  );

  return DynamoDBDocument.from(new DynamoDB({
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: process.env.IAM_ROLE_ARN,
        DurationSeconds: 900,
        Tags: requestTagKeyValueArray
      }
    })
  }));
}

function createRequestTagKeyValueArray(requestTagKeysMappingAttributes: any, decodedToken: any): any {
  const requestTagKeyValueArray: { Key: string; Value: string }[] = [];

  for (const key in requestTagKeysMappingAttributes) {
    const value = requestTagKeysMappingAttributes[key];
    requestTagKeyValueArray.push({Key: key, Value: decodedToken[value]});
  }
  return requestTagKeyValueArray;
}


export function getTenantId(jwtString: string = ""): string {
  let tenant = "UKNOWN";
  if (jwtString.length > 0) {
    const decode = decodeJWT(jwtString);
    tenant = decode.payload['custom:tenantId']?.toString() || "UNKNOWN";
  } else {
    tenant = "HARD_WAY"
  }
  return tenant
}

// From https://github.com/awslabs/aws-jwt-verify/blob/main/src/safe-json-parse.ts
// From https://github.com/awslabs/aws-jwt-verify/blob/main/src/jwt-model.ts
interface JwtPayloadStandardFields {
  exp?: number; // expires: https://tools.ietf.org/html/rfc7519#section-4.1.4
  iss?: string; // issuer: https://tools.ietf.org/html/rfc7519#section-4.1.1
  aud?: string | string[]; // audience: https://tools.ietf.org/html/rfc7519#section-4.1.3
  nbf?: number; // not before: https://tools.ietf.org/html/rfc7519#section-4.1.5
  iat?: number; // issued at: https://tools.ietf.org/html/rfc7519#section-4.1.6
  scope?: string; // scopes: https://tools.ietf.org/html/rfc6749#section-3.3
  jti?: string; // JWT ID: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7
  sub?: string; // JWT sub https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2
}

type JsonPrimitive = null | string | number | boolean;

/** JSON array type */
type JsonArray = (JsonPrimitive | JsonObject | JsonArray)[];

/** JSON Object type */
interface JsonObject {
  [x: string]: JsonPrimitive | JsonArray | JsonObject;
}

export type JwtPayload = JwtPayloadStandardFields & JsonObject;

export interface JWT {
  payload: JwtPayload;

  toString(): string;
}

export function decodeJWT(token: string): JWT {
  const tokenParts = token.split('.');

  if (tokenParts.length !== 3) {
    throw new Error('Invalid token');
  }

  try {
    const base64WithUrlSafe = tokenParts[1];
    const base64 = base64WithUrlSafe.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
        base64Decoder
            .convert(base64)
            .split('')
            .map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
            .join(''),
    );
    const payload = JSON.parse(jsonStr);

    return {
      toString: () => token,
      payload,
    };
  } catch (err) {
    throw new Error('Invalid token payload');
  }
}

interface Base64ConvertOptions {
  urlSafe: boolean;
}

export type Base64DecoderConvertOptions = Base64ConvertOptions;

export interface Base64Decoder {
  convert(input: string, options?: Base64DecoderConvertOptions): string;
}

export const base64Decoder: Base64Decoder = {
  convert(input, options) {
    let inputStr = input;

    // urlSafe character replacement options conform to the base64 url spec
    // https://datatracker.ietf.org/doc/html/rfc4648#page-7
    if (options?.urlSafe) {
      inputStr = inputStr.replace(/-/g, '+').replace(/_/g, '/');
    }

    return getAtob()(inputStr);
  },
};

export const getAtob = () => {
  // browser
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob;
  }

  // Next.js global polyfill
  if (typeof atob === 'function') {
    return atob;
  }

  throw new Error('Cannot resolve the `atob` function from the environment.',);
};
