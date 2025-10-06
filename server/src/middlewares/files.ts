'use strict'

import { Core } from "@strapi/strapi"
import type { Context, Next } from "koa"
import { getContextRouteSchema, ZodValidationError } from "../_utilities"
import { FILES_CONFIG_STRING, FilesSchema, getZodFromSchema } from "../_utilities/files"

export default (config: object, { strapi }: { strapi: Core.Strapi }) => async (ctx: Context, next: Next) => {
    // Exit middleware if the endpoint being called is not a api endpoint
    if(!ctx.request.url.startsWith("/api"))
        return next()

    // Search the schema of the route called in the context
    const schema = getContextRouteSchema<FilesSchema>(strapi, ctx, FILES_CONFIG_STRING)
    if(!schema)
        return next()

    try {
        // Overwrite request files with the parsed object
        ctx.request.files = getZodFromSchema(schema.schema).parse(ctx.request.files || {}) as any
    } catch(error) {
        const _ = new ZodValidationError(error)
        return ctx.badRequest(_, _.details)
    }

    // If code runs here it means no error happend and the middleware can go into the next
    return next()
}
