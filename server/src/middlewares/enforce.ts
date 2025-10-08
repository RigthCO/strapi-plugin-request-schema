'use strict';

import { Core } from "@strapi/strapi";
import type { Context, Next } from "koa";
import { METHODS_TO_IGNORE, SCHEMAS } from "../../utilities/constants";
import type { ConfigSchemas } from "../../utilities/types";
import { ZodValidationError } from "../../utilities";
import { ZodError } from "zod";

export default (config: object , { strapi }: { strapi: Core.Strapi }) => async (ctx: Context, next: Next) => {
    // Exit middleware if the endpoint being called is not a api endpoint
    if(!ctx.request.url.startsWith("/api"))
        return next()

    // Verifies if the request method is any of the defined methods to be ignored any logic in
    if(METHODS_TO_IGNORE.includes(ctx.request.method))
        return next()

    // Just to cleanup the data, make sure that the files and body are always at minimum a empty object
    // undefined variable looks ugly
    ctx.request.files = ctx.request.files || {}
    ctx.request.body = ctx.request.body || {}

    // Iterate the schemas saved of this route
    try {
        for(const schema of getContexSchemas(strapi, ctx)) {
            // Depending on the type of schema send the correct request data
            if(schema.type === "body")
                ctx.request.body = schema.parse(ctx.request.body)
            else if(schema.type === "files")
                ctx.request.files = schema.parse(ctx.request.files) as any
        }
    } catch(error) {
        if(error instanceof ZodError) {
            const e = new ZodValidationError(error)
            return ctx.badRequest(e, e.details)
        }
        throw error
    }

    return next()
};

/** Search the schemas of the route that is about to be called */
export function getContexSchemas(strapi: Core.Strapi, ctx: Context) {
    type Layer = { path: string, methods: string[], match: (path: string) => boolean }

    // Needed request information
    const method = ctx.request.method
    const url = ctx.request.url

    // get all strapi routes
    // and using the path regex, inside the route, find the first route that matches the regex and the method
    const layers = (strapi.server.listRoutes() as Layer[]).filter(route => route.match(url) && route.methods.includes(method))
    let layer = null
    // Problem here is the "path: '/((?!uploads/).+)'" with "regexp: /^(?:\/((?!uploads\/).+))[\/#\?]?$/i"
    // This is found in every route
    // So verify if more than 1 layer
    if(layers.length > 1)
        layer = layers.find(l => l.path !== "/((?!uploads/).+)")
    else
        layer = layers[0]
    
    if(!layer)
        return []
    // Remove the "/api" part of the string that is inside the Layer object
    const path = layer.path.replace("/api", "")

    // Search in the given config string for the route schema
    return (strapi.config.get(SCHEMAS, {}) as ConfigSchemas)[`${method}::${path}`] || []
}
