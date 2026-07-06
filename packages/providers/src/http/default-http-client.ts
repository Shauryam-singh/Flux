import { AxiosHttpClient } from "./axios-http-client.js";

export const defaultHttpClient =
    new AxiosHttpClient({
        timeout: 30000,
    });