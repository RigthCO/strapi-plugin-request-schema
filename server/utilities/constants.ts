'use strict';

/** Name of the plugin */
export const NAME = "strapi-plugin-request-schema"
/** Plugin string saved inside Strapi */
export const PLUGIN = `plugin::${NAME}`
/** Config string to access the schemas */
export const SCHEMAS = `${PLUGIN}.schemas`

/** Methods to be ignored by any logic of the plugin. For example it will not execute the middleware in these methods */
export const METHODS_TO_IGNORE = ["GET"]
