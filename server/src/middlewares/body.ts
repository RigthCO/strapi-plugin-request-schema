'use strict'

import { Core } from "@strapi/strapi"
import type { Context, Next } from "koa"
import { getContextRouteSchema, ZodValidationError } from "../_utilities"
import { BODY_CONFIG_STRING, BodySchema, getZodFromSchema } from "../_utilities/body"

export default (config: object, { strapi }: { strapi: Core.Strapi }) => async (ctx: Context, next: Next) => {
    // Exit middleware if the endpoint being called is not a api endpoint
    if(!ctx.request.url.startsWith("/api"))
        return next()

    // Search the schema of the route called in the context
    const schema = getContextRouteSchema<BodySchema>(strapi, ctx, BODY_CONFIG_STRING)
    if(!schema)
        return next()

    try {
        // Overwrite request body with the parsed body
        ctx.request.body = getZodFromSchema(schema.schema).parse(ctx.request.body || {})
    } catch(error) {
        const _ = new ZodValidationError(error)
        return ctx.badRequest(_, _.details)
    }

    // If code runs here it means no error happend and the middleware can go into the next
    return next()
}
