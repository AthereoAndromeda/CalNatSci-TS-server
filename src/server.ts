import { FastifyInstance, FastifyLoggerInstance } from "fastify";
import fsp from "fs/promises";
import path from "path";
import gqlSchema from "./graphql";
import fastifyCors from "fastify-cors";
import mercurius from "mercurius";
import { Route } from "typings";
import { checkNodeEnv } from "./utils";
import { IncomingMessage, Server, ServerResponse } from "http";
// import middiePlugin from "middie";
import fastifyBlipp from "fastify-blipp";
import fastifyHelmet from "fastify-helmet";
import prismaPlugin from "./plugins/prisma";

function registerPlugins(app: FastifyInstance) {
    const ctx = {
        db: app.db,
    };

    // app.register(fastifyGracefulShutdown);

    app.register(fastifyBlipp);

    app.register(fastifyHelmet);

    // app.register(middiePlugin);

    app.register(mercurius, {
        schema: gqlSchema,
        graphiql: "playground",
        context: () => ctx,
    });

    app.register(fastifyCors, {
        origin: "*",
    });

    if (checkNodeEnv("development")) {
        import("altair-fastify-plugin").then(data => {
            const Altair = data.default;

            app.register(Altair, {
                path: "/altair",
            });
        });
    }
}

function registerCustomPlugins(app: FastifyInstance) {
    app.register(prismaPlugin);
}

async function registerRoutes(app: FastifyInstance) {
    // Checks for file that ends in `.ts` or `.js`
    const validFileRegex = /\.js$|\.ts$/;

    const FilesInRoutes = await fsp.readdir(
        path.resolve(__dirname, "./routes/")
    );

    const routeFiles = FilesInRoutes.filter(file => validFileRegex.test(file));

    for (const routeFile of routeFiles) {
        const routeImport = await import(`./routes/${routeFile}`);
        const { path, route }: Route = routeImport.default;

        app.register(route, { prefix: path });
    }
}

export type BuildReturn = FastifyInstance<
    Server,
    IncomingMessage,
    ServerResponse,
    FastifyLoggerInstance
>;

/**
 * Build the Fastify Server
 * @param app Fastify app
 * @param opts Server Options
 * @returns Built Fastify App or Server
 */
export default async function buildServer(
    app: FastifyInstance
): Promise<BuildReturn> {
    try {
        registerPlugins(app); // 1

        registerCustomPlugins(app);

        await registerRoutes(app); // 2
        // app.decorate("db", opts.prisma); // 3

        return app;
    } catch (err) {
        app.log.error(err);
        throw new Error(err);
    }
}
