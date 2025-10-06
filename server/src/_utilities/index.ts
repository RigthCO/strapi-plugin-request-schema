'use strict'

import type { Core } from '@strapi/strapi'
import type { Context } from "koa"
import z from "zod"



////////////////////////
// Methods
////////////////////////
/** Verifies if the given middleware is after (in the strapi middlewares list) another given middleware */
export function isMiddlewareAfter(strapi: Core.Strapi, middleware: string, after: string) {
    // get the middlewares list of the end user
    const middlewares: string[] = strapi.config.get("middlewares")

    // Search index of the given middleware string
    const middlewareI = middlewares.findIndex(m => m === `${"plugin::strapi-plugin-request-schema"}.${middleware}`)
    // If the index = -1 it means its not being called
    if(middlewareI === -1)
        return true

    // search index of the "after" middleware
    const afterI = middlewares.findIndex(m => m === after)
    // If our middleware is above its ok
    if(middlewareI > afterI)
        return true

    // Not ok if below, cannot allow to start strapi instance in that case
    throw new Error(`Invalid "${"plugin::strapi-plugin-request-schema"}.${middleware}" middleware positioning at "/config/middlewares.(js|ts)", make sure that its anywhere after the "${after}" middleware`)
}

/** Creates a name to the given route information, the name is the concatenation of `${route.method}::${route.path}` */
export function getRouteIdentification(method: string, path: string) {
    return `${method}::${path}`
}

/** Search the schema of the route that will be called in the current context */
export function getContextRouteSchema<T>(strapi: Core.Strapi, ctx: Context, configString: string) {
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
    if(layers.length > 1) {
        layer = layers.find(l => l.path !== "/((?!uploads/).+)")
    } else {
        layer = layers[0]
    }
    
    if(!layer)
        return
    // Remove the "/api" part of the string that is inside the Layer object
    const path = layer.path.replace("/api", "")

    // Search in the given config string for the route schema
    return (strapi.config.get(configString, {}) as Record<string, T>)[getRouteIdentification(method, path)] 
}



////////////////////////
// Types & Classes
////////////////////////
// Since IntelliSense cant get information on strapi Router.Layer[], created this type with some of the needed properties and methods
type Layer = {
    path: string
    methods: string[]
    match: (path: string) => boolean
}

/** Responsible of handling error thrown when parsing Zod Schemas */
export class ConfigSchemaError extends Error {
    details: { [key: string]: string } = {}

    constructor(route: Core.Route, error: unknown) {
        super(`Invalid schema at endpoint "${route.method} ${route.path}" with handler "${route.handler}".`)
        this.name = `ConfigSchemaError`

        // Parse Zod issues
        for(const issue of (error as z.ZodError).issues)
            this.#parse(issue)

        // Re-write the stack for custom message
        this.stack = `${this.name}: ${this.message}\ndetails: ${JSON.stringify(this.details, null, 4)}`
    }

    /** Method to parse the Zod errors and add them into the details in a readable way, so the end user knows what went wrong */
    #parse(zIssue: z.core.$ZodIssue, path?: PropertyKey[]) {
        const p: PropertyKey[] = []
        p.push(...path || [])
        p.push(...zIssue.path)

        // Failsafe verifying if issue is null or not
        if(!zIssue)
            return

        if(zIssue.code === "invalid_value") {
            this.details[p.join(".")] = zIssue.message.replace(/"/ig, "'").replace(/'\|/ig, "' | ")
            return
        }

        if(zIssue.code === "too_big" || zIssue.code === "too_small") {
            this.details[p.join(".")] = zIssue.message
            return
        }

        if(zIssue.code === "invalid_union") {
            // Find the next hierarchy level (below) of this issue
            // The next level will be any inner error that has a path array populated
            // If it doesnt find any will search for the default "invalid_value" error that will aswell have no path
            const next = zIssue.errors.find(e => e[0].path.length)?.[0] || zIssue.errors.find(e => e[0].code === "invalid_value")?.[0]
            if(!next)
                return
            this.#parse(next, p)
        }
    }
}

/** Responsible of handling errors that were caused by the end user not following the defined schema */
export class ZodValidationError extends Error {
    details: object | undefined
    constructor(error: unknown) {
        // Since its not Zod error handle it as a normal error
        if(!(error instanceof z.ZodError)) {
            let e = (error as Error)
            super(e.message)
            this.stack = e.stack
            return
        }
        // Here we know its a zod error
        super(`${error.issues.length} error${error.issues.length > 1 ? "s": ""} occurred`)
        this.name = "ValidationError"
        this.details = { errors: error.issues }
    }
}



////////////////////////
// bootstrap
////////////////////////
import { bootstrap as bootstrap$1 } from "./body"
import { bootstrap as bootstrap$2 } from "./files"
/** Exports all methods to be executed in the bootstrap. Every method must have as a single parameter the strapi core object */
export const bootstraps = {
    bootstrap$1,
    bootstrap$2,
}