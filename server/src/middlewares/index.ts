'use strict'

import { FILES_MIDDLEWARE_NAME } from '../_utilities/files'
import { BODY_MIDDLEWARE_NAME } from '../_utilities/body'
import middleware$1 from './body'
import middleware$2 from './files'

export default {
    [BODY_MIDDLEWARE_NAME]: middleware$1,
    [FILES_MIDDLEWARE_NAME]: middleware$2,
}
