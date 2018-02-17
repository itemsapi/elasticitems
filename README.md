# ElasticItems

Higher level client for Elasticsearch in Node.js oriented on facets. It's a compact version of ItemsAPI without API.

## Features

- faceted search
- full text
- pagination
- big data support

## Getting Started

```bash
npm install elasticitems
```

```js
const elasticitems = require('elasticitems')(es_config, search_config);
elasticitems.search()
.then(result => {
  console.log(result);
})
```

## API

### var elasticitems = ElasticItems(es_config, [search_config])

#### `es_config`

The first `es_config` is elasticsearch configuration object and contains values like `host`, `index` or `type`.

#### `search_config`

Responsible for defining global configuration.

  * **<code>aggregations</code>** filters configuration i.e. for `tags`, `actors`, `colors`, etc. Responsible for generating facets.

  * **<code>sortings</code>** you can configure different sortings like `tags_asc`, `tags_desc` with options and later use it with one key.

### elasticitems.search(options, [search_config])

#### `options`

  * **<code>per_page</code>** amount of items per page.

  * **<code>page</code>** page number - used for pagination.

  * **<code>query</code>** used for full text search.

  * **<code>sort</code>** used for sorting. one of `sortings` key
  
  * **<code>filters</code>** filtering items based on specific aggregations i.e. {tags: ['drama' , 'historical']}  

  * **<code>query_string</code>** i.e. "brand:Audi OR brand:Mercedes"

### elasticitems.similar(id, options)

Show similar items based on collaborative filtering

#### `options`

  * **<code>fields</code>** i.e ['tags'].

### elasticitems.aggregation(options)

It returns full list of filters for specific aggregation

#### `options`

  * **<code>name</code>** aggregation name

  * **<code>per_page</code>** filters per page
  
  * **<code>size</code>** how much load into memory (for pagination)

  * **<code>page</code>** page number
  
  * **<code>sort</code>** responsible for sorting mechanism. It can be `_count` or `_term`

  * **<code>order</code>** responsible for an order. It can be `asc` or `desc`

  * **<code>filters</code>** filter this aggregation through another aggregations (facets)

  * **<code>aggregation_query</code>** used for quering filters. It's not full text search

  * **<code>query</code>** search through items

  * **<code>query_string</code>** search through items by query string i.e. (category:Garden and color:red)
  
### elasticitems.get(id)

Returns found record otherwise throw an error

### elasticitems.getBy(key, value)

Returns record based on key and value 

### elasticitems.add(data, [options])

Add a new object into index. Provide your own `id` if you don't want it auto-generated

### elasticitems.partialUpdate(id, data, [options])

Updates object in index

### elasticitems.delete(id)

Delete object from index
