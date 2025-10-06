/**
 * Application methods
 */
import bootstrap from './bootstrap'

/**
 * Plugin server methods
 */

export default {
    bootstrap,
}

// TODO
// Refactor again the plugin
// file to zod stuff
// file to errors etc etc
// Re-add the config.ts and export it (maybe im doing some bad programming not having it)
// strapi.config.get("strapi-plugin-request-schema") this is retorning nothing and im not sure it should have the config the end user add's into the config/plugin file
// the thing is, this is capable of accessing the config strapi.plugin("strapi-plugin-request-schema").config("bar") but im not sure if those configs are 2 different configs
