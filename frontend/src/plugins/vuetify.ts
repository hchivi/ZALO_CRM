import { zaloThemes, zaloDefaults } from '@/modules/zalocrm/themes'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default createVuetify({
  components,
  directives,
  defaults: zaloDefaults,
  theme: {
    defaultTheme: 'forestTheme',
    themes: {
      ...zaloThemes,
    },
  },
})
