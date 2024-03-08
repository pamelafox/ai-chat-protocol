// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  KeyCredential,
  RequestParameters,
  isKeyCredential,
  TokenCredential,
  getClient,
  Client,
  ClientOptions,
} from "@typespec/ts-http-runtime";
import {
  AIChatMessage,
  AIChatCompletion,
  AIChatCompletionOptions,
  AIChatCompletionDelta,
} from "./models/index.js";
import { getAsyncIterable } from "./util/ndjson.js";
import { asStream } from "./http/send.js";

/* Replace with a version provided by the ts-http-runtime library once that is provided. */
function isTokenCredential(credential: unknown): credential is TokenCredential {
  const castCredential = credential as {
    getToken: unknown;
    signRequest: unknown;
  };
  return (
    castCredential &&
    typeof castCredential.getToken === "function" &&
    (castCredential.signRequest === undefined ||
      castCredential.getToken.length > 0)
  );
}

function isCredential(
  credential: unknown,
): credential is TokenCredential | KeyCredential {
  return isTokenCredential(credential) || isKeyCredential(credential);
}

export class AIChatProtocolClient {
  private client: Client;

  constructor(endpoint: string);
  constructor(endpoint: string, options: ClientOptions);
  constructor(endpoint: string, credential: TokenCredential | KeyCredential);
  constructor(
    endpoint: string,
    credential: TokenCredential | KeyCredential,
    options: ClientOptions,
  );
  constructor(
    endpoint: string,
    arg1?: TokenCredential | KeyCredential | ClientOptions,
    arg2?: ClientOptions,
  ) {
    if (isCredential(arg1)) {
      this.client = getClient(endpoint, arg1, arg2);
    } else {
      this.client = getClient(endpoint, arg1);
    }
  }

  getCompletion(messages: AIChatMessage[]): Promise<AIChatCompletion>;
  getCompletion(
    messages: AIChatMessage[],
    options: AIChatCompletionOptions,
  ): Promise<AIChatCompletion>;
  async getCompletion(
    messages: AIChatMessage[],
    options: AIChatCompletionOptions = {},
  ): Promise<AIChatCompletion> {
    const request: RequestParameters = {
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        messages: messages,
        stream: false,
        context: options.context,
        sessionState: options.sessionState,
      },
    };
    const response = await this.client.path("").post(request, options);
    if (!/2\d\d/.test(response.status)) {
      throw new Error(`Request failed with status code ${response.status}`);
    }
    return response.body as AIChatCompletion;
  }

  getStreamedCompletion(
    messages: AIChatMessage[],
  ): Promise<AsyncIterable<AIChatCompletionDelta>>;
  getStreamedCompletion(
    messages: AIChatMessage[],
    options: AIChatCompletionOptions,
  ): Promise<AsyncIterable<AIChatCompletionDelta>>;
  async getStreamedCompletion(
    messages: AIChatMessage[],
    options: AIChatCompletionOptions = {},
  ): Promise<AsyncIterable<AIChatCompletionDelta>> {
    const request: RequestParameters = {
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        messages: messages,
        stream: true,
        context: options.context,
        sessionState: options.sessionState,
      },
    };
    const response = await asStream(
      this.client.path("").post(request, options),
    );
    if (!/2\d\d/.test(response.status)) {
      throw new Error(`Request failed with status code ${response.status}`);
    }

    return getAsyncIterable<AIChatCompletionDelta>(response.body);
  }
}
