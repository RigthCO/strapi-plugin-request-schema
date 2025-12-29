/**
 * Application methods
 */
import bootstrap from './bootstrap';

/**
 * Plugin server methods
 */

export default {
    bootstrap,
};

// TODO
// file to zod stuff
// file to errors etc etc
// Re-add the config.ts and export it (maybe im doing some bad programming not having it)
// strapi.config.get("strapi-plugin-request-schema") this is retorning nothing and im not sure it should have the config the end user add's into the config/plugin file
// the thing is, this is capable of accessing the config strapi.plugin("strapi-plugin-request-schema").config("bar") but im not sure if those configs are 2 different configs

/* 
- Do not allow to define a schema with a empty object, since the middleware validates for non empty objects here should happne the same
- Add more schemas?? Maybe for filters
- Better errors
- Better zod coerce
- Allow empty objects when parsing the request body
- Redo the zod schema that parses the request files
 */