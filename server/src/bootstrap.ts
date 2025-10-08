'use strict';

import type { Core } from '@strapi/strapi';
import middlewares from './middlewares';
import { Schema } from '../utilities';
import { METHODS_TO_IGNORE, SCHEMAS } from '../utilities/constants';
import type { ConfigSchemas } from '../utilities/types';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
    // Use the middleware so the end user doesnt need to have the worry of calling or not the middleware in the "config/middlewares"
    // The config object the middleware is waiting is the config that the end user can give when adding the middleware
    // For example: { name: "plugin::strapi-plugin-request-schema.foo", config: { foo: "bar" } }, the object inside this config would be the one to appear inside the middleware
    // Since we dont need any extra config, send empty object (it is what the middleware would recieve if no config was send eitehr way)
    strapi.server.use(middlewares.enforce({}, { strapi })) 

    // Get and Save the schemas inside the plugin config
    strapi.config.set(SCHEMAS, getInstanceSchemas(strapi))
};

/** Method to search for routes that have schemas */
function getInstanceSchemas(strapi: Core.Strapi) {
    // Object that will hold all found schemas
    const schemas: ConfigSchemas = {}

    for(const core of [...Object.values(strapi.apis), ...Object.values(strapi.plugins)]) {
        for(const router of Object.values(core.routes as Record<string, Core.Router>)) {
            // Do not execute any logic that is not from a valid router type
            if(router.type !== "content-api")
                continue
            for(const route of router.routes) {
                // Route has to be valid type
                // route has to have a config
                // route has to be a not ignored method
                if(route.info.type !== "content-api" || !route.config || METHODS_TO_IGNORE.includes(route.method))
                    continue
                // If there is no body / files inside the config object skip the route
                if(!("body" in route.config || "files" in route.config))
                    continue

                for(const x of ["body", "files"] as const) {
                    if(!(x in route.config))
                        continue
                    // Verifies if the route is already inside the schemas object
                    // If not create it
                    if(!schemas[`${route.method}::${route.path}`])
                        schemas[`${route.method}::${route.path}`] = []
                    // push the schema
                    schemas[`${route.method}::${route.path}`].push(new Schema(x, (route.config as any)[x] as object, route))
                }
            }
        }
    }

    return schemas
}

export default bootstrap;
