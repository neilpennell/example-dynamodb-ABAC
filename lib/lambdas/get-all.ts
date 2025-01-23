import {DynamoDBDocument, QueryCommandInput} from '@aws-sdk/lib-dynamodb';
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {CORS_HEADERS} from "./constants";
import {decodeJWT, getDynamoDbClient, getTenantId} from "./utils";

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';


const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2';
let db: DynamoDBDocument;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.debug(event)

  console.debug(decodeJWT(event.headers.Authorization?.toString() || ""));
  console.debug("event.headers.Authorization?\n", event.headers.Authorization);

  db = getDynamoDbClient(event.headers.Authorization?.toString() || "", REGION);

  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: `${PRIMARY_KEY} = :tenant`,
    ExpressionAttributeValues: {
      ":tenant": getTenantId(event.headers.Authorization)
    }
  };

  let statusCode = 200;
  let body = '';
  try {
    console.debug("params", params);
    const response = await db.query(params);
    console.debug("response", JSON.stringify(response));
    body = JSON.stringify(response.Items);
  } catch (dbError: any) {
    console.error(dbError, params);
    statusCode = 500;
    body = JSON.stringify(dbError);
  }
  db.destroy();
  return {
    statusCode: statusCode,
    headers: CORS_HEADERS,
    body: body
  };

};

