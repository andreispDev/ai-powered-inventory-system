import { getAuth } from "@/server/auth/config";

const handle = (request: Request) => getAuth().handler(request);

export const GET = handle;
export const POST = handle;
