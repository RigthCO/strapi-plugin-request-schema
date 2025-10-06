'use strict'

import type { Core } from '@strapi/strapi'
import z from "zod"
import { ConfigSchemaError, getRouteIdentification, isMiddlewareAfter } from './index'

/** Plugin config string */
export const BODY_CONFIG_STRING = `${"plugin::strapi-plugin-request-schema"}.body.schemas`
/** Middleware name */
export const BODY_MIDDLEWARE_NAME = `body-enforce`

// Zod schemas
const LITERALS = ["string", "[string]", "number", "[number]", "boolean", "[boolean]"] as const
type BSchema = { [key: string]: typeof LITERALS[number] | BSchema | BSchema[] }
const ZodBodySchema: z.ZodType<BSchema> = z.lazy(() =>
    z.object().catchall(
        z.union([
            z.literal(LITERALS),
            ZodBodySchema,
            z.array(ZodBodySchema).length(1),
        ])
    )
)

/**
 * Utilizes a given schema to create a Zod object to parse the `ctx.request.body`
 * @param schema Config Schema previouly parsed by Zod and in this stage its a 100% correct schema
 */
export function getZodFromSchema(schema: BSchema = {}) {
    // Object to be populated and then used to create the zod variable
    const obj: Record<string, unknown> = {}

    for(const key of Object.keys(schema)) {
        const value = schema[key]

        // If the current iteration is a array (it makes it being a object array) call recursively to parse the object inside of it (it always exist aswell)
        if(Array.isArray(value)) {
            // Since it will be array of objects, this same keys validation needs to happen
            obj[key] = z.array(getZodFromSchema(value[0]).optional().superRefine(superRefine)).optional()
            continue
        }
        // Current iteration, not being array and string it means its a object
        if(typeof value !== "string") {
            obj[key] = getZodFromSchema(value).optional().superRefine(superRefine)
            continue
        }

        // Save zod collected inside the next switch/case
        let zod = null
        // Do a switch case and verify if the value of the current key is any of those
        switch(value) {
            case "[number]": zod = z.coerce.number().array().optional(); break
            case "number": zod = z.coerce.number().optional(); break
            case "[string]": zod = z.string().array().optional(); break
            case "string": zod = z.string().optional(); break
            case 'boolean': zod = z.coerce.boolean().optional(); break
            case '[boolean]': zod = z.coerce.boolean().array().optional(); break
        }
        // If for some reason the switch gave no value to zod then something is wrong and skip iteration
        if(!zod)
            continue
        obj[key] = zod
    }

    return z.object(obj)
}
/** Method to be called when super refining a object to make sure it has at least one key inside of it */
function superRefine(obj: Record<string, unknown> | undefined, ctx: z.core.$RefinementCtx<Record<string, unknown> | undefined>) {
    // Error if the object has no keys
    if(obj === undefined || Object.keys(obj).length)
        return
    ctx.addIssue({ code: "invalid_type", expected: "object", message: "Invalid input: expected populated object, received empty object" })
}

/** Schema holding one route body configuration */
export class BodySchema {
    schema: BSchema = {}

    constructor(route: Core.Route) {
        // The route is already filtered and is 100% valid, cast it to have direct access to the "config.body"
        this.schema = (route as any).config.body

        // Parse the schema verifying if they will throw or not errors
        try {
            ZodBodySchema.parse(this.schema)
        } catch(error) {
            throw new ConfigSchemaError(route, error)
        }
    }
}

/** Method that will be called in the bootstrap of the Strapi instance to populate the plugin config with the body schemas */
export function bootstrap(strapi: Core.Strapi) {
    // Validate if the body middleware is anywhere after the strapi::body middleare
    // This needs to happpen because to have access to the `ctx.request.body` the `strapi::body` middleware needs to be already executed
    isMiddlewareAfter(strapi, BODY_MIDDLEWARE_NAME, "strapi::body")

    // Object that will hold all found and valid schemas
    const schemas: Record<string, BodySchema> = {}

    for(const router of getValidAPIRouters(strapi)) {
        for(const route of getValidRouterRoutes(router)) {
            // Here the route is fully valid having the `config.body` in the route
            schemas[getRouteIdentification(route.method, route.path)] = new BodySchema(route)
        }
    }

    // Save the schemas inside the plugin config
    strapi.config.set(BODY_CONFIG_STRING, schemas)
}



/** Search inside strapi valid api routers from normal api or from plugins */
function getValidAPIRouters(strapi: Core.Strapi) {
    const apis = strapi.apis
    const plugins = strapi.plugins

    const routers = []
    // get api routers
    for(const api of Object.values(apis)) {
        routers.push(...Object.values(api.routes).filter(router => {
            // Not a valid router is it has no routes
            if(!router.routes.length)
                return false
            // Not a valid router is is not of api type
            if(router.type !== "content-api")
                return false
            return true
        }))
    }
    // get plugin routers
    for(const plugin of Object.values(plugins)) {
        routers.push(...Object.values(plugin.routes).filter(router => {
            // Not a valid router is it has no routes
            if(!router.routes.length)
                return false
            // Not a valid router is is not of api type
            if(router.type !== "content-api")
                return false
            return true
        }))
    }
    return routers
}

function getValidRouterRoutes(router: Core.Router) {
    return router.routes.filter(route => {
        // Since there is no "ctx.request.body" parsed when the method is a GET, do not return as a valid route those GETs
        if(route.method === "GET")
            return false
        // If the route has no config then its not valid
        if(!("config" in route) || !route.config)
            return false
        // Verifies if there is a body property inside the config object
        if("body" in route.config && route.config.body)
            return true
        return false
    })
}
