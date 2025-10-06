'use strict'

import type { Core } from '@strapi/strapi'
import z from "zod"
import { ConfigSchemaError, getRouteIdentification, isMiddlewareAfter } from './index'
import { PersistentFile } from "formidable"

/** Plugin config string */
export const FILES_CONFIG_STRING = `${"plugin::strapi-plugin-request-schema"}.files.schemas`
/** Middleware name */
export const FILES_MIDDLEWARE_NAME = `files-enforce`

// Zod schemas
const LITERALS = ["file", "[file]"] as const
type FSchema = { [key: string]: typeof LITERALS[number] }
const ZodFilesSchema: z.ZodType<FSchema> = z.object().catchall(
    z.union([
        z.literal(LITERALS),
    ])
)

/** Schema holding one route files configuration */
export class FilesSchema {
    schema: FSchema = {}

    constructor(route: Core.Route) {
        // The route is already filtered and is 100% valid, cast it to have direct access to the "config.body"
        this.schema = (route as any).config.files

        // Parse the schema verifying if they will throw or not errors
        try {
            ZodFilesSchema.parse(this.schema)
        } catch(error) {
            throw new ConfigSchemaError(route, error)
        }
    }
}

/**
 * Utilizes a given schema to create a Zod object to parse the `ctx.request.files`
 * @param schema Config Schema previouly parsed by Zod and in this stage its a 100% correct schema
 */
export function getZodFromSchema(schema: FSchema = {}) {
    // Object to be populated and then used to create the zod variable
    const obj: Record<string, unknown> = {}

    for(const key of Object.keys(schema)) {
        const value = schema[key]
        // Save zod collected inside the next switch/case
        let zod = null
        // Do a switch case and verify if the value of the current key is any of those
        switch(value) {
            case "[file]": zod = z.array(z.custom().optional().superRefine(superRefine)).optional(); break
            case "file": zod = z.custom().optional().superRefine(superRefine); break
        }
        // If for some reason the switch gave no value to zod then something is wrong and skip iteration
        if(!zod)
            continue
        obj[key] = zod
    }

    return z.object(obj)
}
/** Method to be called when super refining a object to make sure it is a file */
function superRefine(arg: unknown, ctx: z.core.$RefinementCtx<unknown>) {
    // Verify if the object is a instance of formidable PersistentFile
    if(arg === undefined || arg === null || arg.constructor.name === PersistentFile.name)
        return
    ctx.addIssue({ code: "invalid_type", expected: "file", message: "Invalid input: expected file" })
}


/** Method that will be called in the bootstrap of the Strapi instance to populate the plugin config with the body schemas */
export function bootstrap(strapi: Core.Strapi) {
    // Validate if the body middleware is anywhere after the strapi::body middleare
    // This needs to happpen because to have access to the `ctx.request.files` the `strapi::body` middleware needs to be already executed
    isMiddlewareAfter(strapi, FILES_MIDDLEWARE_NAME, "strapi::body")

    // Object that will hold all found and valid schemas
    const schemas: Record<string, FilesSchema> = {}

    for(const router of getValidAPIRouters(strapi)) {
        for(const route of getValidRouterRoutes(router)) {
            // Here the route is fully valid having the `config.files` in the route
            schemas[getRouteIdentification(route.method, route.path)] = new FilesSchema(route)
        }
    }

    // Save the schemas inside the plugin config
    strapi.config.set(FILES_CONFIG_STRING, schemas)
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
        // Verifies if there is a files property inside the config object
        if("files" in route.config && route.config.files)
            return true
        return false
    })
}
