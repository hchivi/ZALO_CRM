<template>
  <section class="zalo-module" :class="{ 'zalo-chat-module': route.meta.zaloView === 'ChatView' }">
    <header class="module-heading"><div><p>{{ route.meta.group }}</p><h2>{{ route.meta.title }}</h2></div><div class="module-actions"><router-link v-if="route.params.id && route.meta.zaloView === 'ContactDetailView'" to="/customers" class="btn-forest-secondary">Hồ sơ khách hàng</router-link><button v-if="route.params.id && route.meta.zaloView === 'ContactDetailView'" class="btn-forest-primary" :disabled="linking" @click="linkCustomer">Lưu vào khách hàng portal</button><router-link v-if="route.meta.zaloView === 'OrdersView'" to="/sales/orders" class="btn-forest-primary">Đơn hàng nghiệp vụ</router-link><router-link v-if="route.meta.zaloView === 'ContactsView'" to="/customers" class="btn-forest-secondary">Khách hàng portal</router-link><button class="btn-forest-secondary" @click="load" :disabled="loading">Kết nối lại</button></div></header>
    <div v-if="error" class="connection-error" role="alert"><strong>{{ error }}</strong><p>Chọn đúng thương hiệu trên thanh công cụ, sau đó thử kết nối lại.</p></div>
    <div v-else-if="loading" class="connection-state">Đang kết nối dữ liệu {{ brandName }}…</div>
    <component v-else-if="currentView" :is="currentView" :key="route.path" />
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
const route=useRoute(), auth=useAuthStore();
const modules=import.meta.glob('../views/*.vue');
const cache=new Map<string,any>();
const currentView=computed(() => { const name=String(route.meta.zaloView||''); const loader=modules[`../views/${name}.vue`]; if (!loader) return null; if (!cache.has(name)) cache.set(name,markRaw(defineAsyncComponent(loader as any))); return cache.get(name); });
const loading=ref(true), error=ref(''), linking=ref(false);
const brandName=(window as any).APP_CONFIG?.brands?.find((b:any)=>b.id === (window as any).APP_CONFIG?.activeBrandId)?.name || '';
async function load(){ loading.value=true; error.value=''; try{await auth.init();}catch(e){error.value=(e as Error).message;}finally{loading.value=false;} }
async function linkCustomer(){linking.value=true;try{const response=await fetch(`/api/zalo-native/contacts/${route.params.id}`,{method:'POST',headers:{Accept:'application/json','X-CSRF-TOKEN':(window as any).APP_CONFIG.csrfToken}});const data=await response.json();if(!response.ok)throw new Error(data.message||'Không lưu được hồ sơ.');window.location.assign(data.url);}catch(e){error.value=(e as Error).message;}finally{linking.value=false;}}
onMounted(load);
watch(()=>route.meta.zaloView,()=>{error.value='';});
</script>
<style scoped>
.zalo-module{min-height:70vh;--crm-line:rgba(19,42,35,.1);--crm-muted:#64756d;--liquid-ease:cubic-bezier(.4,0,.2,1)}.module-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.module-heading p{font-size:11px;color:var(--color-text-secondary);margin-bottom:5px}.module-heading h2{font-size:23px}.module-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.connection-error{border:1px solid #efd2ca;color:#a2442e;border-radius:12px;padding:22px;background:#fff8f4;font-size:13px}.connection-error p{margin-top:10px}.connection-state{padding:80px;text-align:center;color:var(--color-text-secondary)}.zalo-chat-module{height:calc(100dvh - 112px);display:flex;flex-direction:column;min-height:550px}.zalo-chat-module .module-heading{flex-shrink:0;margin-bottom:12px}.zalo-chat-module :deep(.chat-container){flex:1;min-height:0;overflow:hidden;border:1px solid var(--color-border);border-radius:12px;background:white}.zalo-module :deep(.v-card){border:1px solid var(--color-border);border-radius:12px}.zalo-module :deep(.v-btn){text-transform:none;letter-spacing:0}.zalo-module :deep(h1.text-h4){font-size:19px!important}.zalo-module :deep(.v-field){font-size:13px}@media(max-width:959px){.zalo-chat-module{min-height:0;height:calc(100dvh - 104px)}.connection-state{padding:40px 16px}}@media(max-width:760px){.module-heading{align-items:flex-start;flex-direction:column}.module-actions{gap:6px}.module-actions button,.module-actions a{font-size:11px;padding:6px 9px}}
</style>
