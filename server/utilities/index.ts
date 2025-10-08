'use strict';

import type { Core } from '@strapi/strapi';
import { ValidationError } from '@strapi/utils/dist/errors';
import z from "zod";

/** Zod literals available to be used in the body schema */
const BODY_LITERALS = ["string", "[string]", "number", "[number]", "boolean", "[boolean]"] as const
type BodySchema = { [key: string]: typeof BODY_LITERALS[number] | BodySchema | BodySchema[] }
/** Zod to parse the body schema */
const ZodBodySchema: z.ZodType<BodySchema> = z.lazy(() =>
    z.object().catchall(
        z.union([
            z.literal(BODY_LITERALS),
            ZodBodySchema,
            z.array(ZodBodySchema).length(1),
        ])
    )
)

/** Zod literals available to be used in the files schema */
const FILES_LITERALS = ["file", "[file]"] as const
type FilesSchema = { [key: string]: typeof FILES_LITERALS[number] }
const ZodFilesSchema: z.ZodType<FilesSchema> = z.object().catchall(
    z.union([
        z.literal(FILES_LITERALS),
    ])
)

/** Creates a zod schema from a schema */
function getZodFromSchema(schema: BodySchema | FilesSchema) {
    // Object to be populated and then used to create the zod variable
    const obj: Record<string, unknown> = {}

    for(const key of Object.keys(schema)) {
        const value = schema[key]

        // Save zod collected inside the next switch/case
        let zod = null
        // Do a switch case and verify if the value of the current key is any of those
        switch(value) {
            case "[number]": zod = z.coerce.number().array().optional(); break
            case "number": zod = z.coerce.number().optional(); break
            case "[string]": zod = z.string().array().optional(); break
            case "string": zod = z.string().optional(); break
            case "boolean": zod = z.coerce.boolean().optional(); break
            case "[boolean]": zod = z.coerce.boolean().array().optional(); break
            case "file": zod = z.custom().optional().superRefine(file); break
            case "[file]": zod = z.array(z.custom().optional().superRefine(file)).optional(); break
        }
        // If the zod variable is not null it means the switch had success, add the key and leave
        if(zod) {
            obj[key] = zod
            continue
        }

        // If the current iteration is a array (it makes it being a object array) call recursively to parse the object inside of it (it always exist aswell)
        if(Array.isArray(value)) {
            // Since it will be array of objects, this same keys validation needs to happen
            obj[key] = z.array(getZodFromSchema(value[0]).optional().superRefine(object)).optional()
            continue
        }

        // Current iteration, not being literal nor array it means its a object
        obj[key] = getZodFromSchema(value as BodySchema).optional().superRefine(object)
    }

    return z.object(obj)
}

/** Method to be called when super refining a object to make sure it is a file */
function file(arg: unknown, ctx: z.core.$RefinementCtx<unknown>) {
    // Verify if the object is a instance of formidable PersistentFile
    if(arg === undefined || arg === null || arg.constructor.name === "PersistentFile")
        return
    ctx.addIssue({ code: "invalid_type", expected: "file", message: "Invalid input: expected file" })
}

/** Method to be called when super refining a object to make sure it has at least one key inside of it */
function object(obj: Record<string, unknown> | undefined, ctx: z.core.$RefinementCtx<Record<string, unknown> | undefined>) {
    // Error if the object has no keys
    if(obj === undefined || Object.keys(obj).length)
        return
    ctx.addIssue({ code: "invalid_type", expected: "object", message: "Invalid input: expected populated object, received empty object" })
}

type SchemaType = "files" | "body"
export class Schema {
    schema: BodySchema | FilesSchema
    type: SchemaType

    /**
     * @param route - Route of the schema, its only use is to be used when throwing Zod parsing error
     */
    constructor(type: SchemaType, schema: object, route: Core.Route) {
        this.type = type
        this.schema = schema as any

        try {
            // Use Zod to parse the schema and validate that everything is correctly setted by the dev
            if(this.type === "body") {
                ZodBodySchema.parse(this.schema)
                return
            }
            ZodFilesSchema.parse(this.schema)
        } catch(error) {
            if(error instanceof z.ZodError)
                throw  new ZodValidationError(error, route)
            throw error
        }
    }

    /** Try to parse the given data */
    parse(data: any) {
        return getZodFromSchema(this.schema).parse(data)
    }
}

export class ZodValidationError extends ValidationError {
    details: { [key: string]: any } = {}

    constructor(error: z.ZodError, route: Core.Route);
    constructor(error: z.ZodError);

    constructor(error: z.ZodError, route?: Core.Route) {
        super("")

        if(route)
            this.#constructor$1(error, route)
        else
            this.#constructor$2(error)
    }

    /** Constructor to be used when the end client sended a bad request */
    #constructor$2(error: z.ZodError) {
        this.message = `${error.issues.length} error${error.issues.length > 1 ? "s": ""} occurred`
        this.details = { errors: error.issues }
    }

    /** Constructor to be used when exists a route, meaning its a error comming from the dev wrong schema */
    #constructor$1(error: z.ZodError, route: Core.Route) {
        this.message = `Invalid schema at endpoint "${route.method} ${route.path}" with handler "${route.handler}".`
        
        // Parse issues
        for(const issue of (error as z.ZodError).issues)
            this.#parse(issue)
        
        // Re-write the stack for custom readable message
        this.stack = `${this.name}: ${this.message}\ndetails: ${JSON.stringify(this.details, null, 3)}`
    }

    /** Method to parse the Zod errors comming from a wrong schema created by the dev, parse it into a readable way and save it inside the details */
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
