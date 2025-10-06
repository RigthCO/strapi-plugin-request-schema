import type { Core } from '@strapi/strapi'
import { bootstraps } from "./_utilities"
import middlewares from './middlewares';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
    // This will auto use the middlewares, making that the end user doesnt need to load them in the config/middleware file
    // I have no ideia where in the list the middleware is added, but it happens after the strapi::body and that what matters
    // Here not sure what to send on the config... for now send empty since there is no possible plugin config user can add
    strapi.server.use(middlewares["body-enforce"]({}, { strapi }))
    strapi.server.use(middlewares["files-enforce"]({}, { strapi }))
    // Execute bootstraps
    for(const _ of Object.values(bootstraps))
        _(strapi)
}

export default bootstrap;
