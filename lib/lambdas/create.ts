import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb';
import {DynamoDB} from '@aws-sdk/client-dynamodb';
import {v4 as uuidv4} from 'uuid';
import {CORS_HEADERS} from './constants';
import {getDynamoDbClient, getTenantId} from "./utils";

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';
const SORT_KEY = process.env.SORT_KEY || '';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2';
let db: DynamoDBDocument;

export const handler = async (event: any = {}): Promise<any> => {
  console.debug(event);

  if (!event.body) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: 'invalid request, you are missing the parameter body'
    };
  }
  db = getDynamoDbClient(event.headers.Authorization?.toString() || "", REGION);
  const item = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
  item[PRIMARY_KEY] = getTenantId(event.headers.Authorization);
  item[SORT_KEY] = uuidv4();
  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  let statusCode = 200;
  let body = JSON.stringify(item);
  try {
    await db.put(params);
  } catch (dbError: any) {
    console.error(dbError,params);
    statusCode = 500;
    body = JSON.stringify(dbError);
  }
  db.destroy();
  return {
    statusCode: statusCode,
    headers: CORS_HEADERS,
    body: body,
  }
};