<template>
  <v-text-field ref="field" :model-value="display" :rules="rules?.map(rule => () => rule(model))" inputmode="decimal" @update:model-value="update" />
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
defineProps<{ rules?: Array<(value: unknown) => boolean | string> }>();
const model = defineModel<number>({ default: 0 });
const field = ref();
const format = (value: number) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) : '';
const display = ref(format(model.value));
let updating = false;
watch(model, value => { if (!updating) display.value = format(value); });
async function update(value: string | null) {
  const input = field.value?.$el.querySelector('input') as HTMLInputElement | undefined;
  const raw = String(value ?? '');
  const caret = input?.selectionStart ?? raw.length;
  const beforeCaret = raw.slice(0, caret).replace(/,/g, '').length;
  const clean = raw.replace(/,/g, '');
  const valid = /^\d*(?:\.\d{0,2})?$/.test(clean);
  const [whole = '', fraction] = clean.split('.');
  display.value = valid ? (whole ? whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '') + (fraction !== undefined ? '.' + fraction : '') : raw;
  updating = true;
  model.value = valid && clean !== '' && clean !== '.' ? Number(clean) : NaN;
  await nextTick();
  updating = false;
  if (valid && input && document.activeElement === input) {
    let position = 0, seen = 0;
    while (position < display.value.length && seen < beforeCaret) { if (display.value[position] !== ',') seen++; position++; }
    input.setSelectionRange(position, position);
  }
}
</script>
