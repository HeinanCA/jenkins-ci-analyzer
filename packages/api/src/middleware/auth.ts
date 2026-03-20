import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({
      data: null,
      error: "Ah ah ah, you didn't say the magic word!",
      nedry:
        "https://media.tenor.com/2GJlHNr2n1YAAAAC/you-didnt-say-the-magic-word-ah-ah.gif",
    });
  }

  request.tigSession = session;
}

declare module "fastify" {
  interface FastifyRequest {
    tigSession?: {
      session: {
        id: string;
        userId: string;
        expiresAt: Date;
      };
      user: {
        id: string;
        email: string;
        name: string;
      };
    };
  }
}
