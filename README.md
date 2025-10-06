# Strapi v5 - Request Schema

A plugin for [Strapi Headless CMS](https://github.com/strapi/strapi) that provides a way to define a schema at the routes level that will be used to parse the data that is sent in the request.

## Features

- Allows the creation in the route config object a schema follow a set of rules
- When calling a route it will search if there is a defined schema and then parse the request data
- Provides a parsed and expected data, following the defined schema, when accessing the request data at the controllers/services

## How it works

When exporting, non GET, routes at `/api/{api}/routes/{routes}.(js|ts)` it is possible to add extra data into the **config** object.

The plugin searches for routes that have either `body` or `files` inside the **config** object.

Those extra configurations have to follow a set of defined rules when creating the schemas. 

### Body Schema

Inside the **body** object can exist any key, but the pair value has to follow a set of rules:
- Be any of the literal values: `"string"`, `"[string]"`, `"number"`, `"[number]"`, `"boolean"`, `"[boolean]"`
- Be a object, repeating the rules that apply on the main **body** object
    - Objects can be nested inside each other without any max depth
- Be a array of objects, where only a first element **must** exist

NOTE: The literals that are inside `[]` mean that they are expected to be a array of the type inside of it. For example `[string]` is expected to be a array of strings.

```js
{ method: "POST", path: '...', handler: '...', config: {
    body: {
        foo: "string" | "[string]" | "number" | "[number]" | "boolean" | "[boolean]",
        bar: {
            foo: "string" | "[string]" | "number" | "[number]" | "boolean" | "[boolean]",
            bar: {
                foo: "string" | "[string]" | "number" | "[number]" | "boolean" | "[boolean]",
            },
        },
        foobar: [{
            foo: "string" | "[string]" | "number" | "[number]" | "boolean" | "[boolean]",
            bar: {
                foo: "string" | "[string]" | "number" | "[number]" | "boolean" | "[boolean]",
            },
        }],
    }
}}
```

### Files Schema

Inside the **files** object can exist any key but the pair value has to be any of the literal values: `"file"`, `"[file]"`

```js
{ method: "POST", path: '...', handler: '...', config: {
    files: {
        foo: "file" | "[file]",
        bar: "file" | "[file]",
    }
}}
```

## Compatibility

The plugin is currently tested and functional using strapi version `5.24.0`

## Installation

```sh
# Using NPM
npm install strapi-plugin-soft-delete
```

### Configuration

As all other plugins, strapi allows to disable the plugin in `/config/plugins.(js|ts)` without having to uninstall it.

```ts
export default {
    // ...
    "strapi-plugin-request-schema": {
        enabled: false,
    },
    // ...
}
```

## TODO

- Do not allow to define a schema with a empty object, since the middleware validates for non empty objects here should happne the same
- Major refactoring (code is a mess)
- Add more schemas?? Maybe for filters
- Better errors
- Better zod coerce
- Allow empty objects when parsing the request body
- Redo the zod schema that parses the request files