<template>
  <v-defaults-provider :defaults="zaloDefaults">
    <ZaloSalesLayout v-if="ready">
      <div v-if="config.currentUser && (route.name==='ZaloContactDetail' || route.name==='ZaloOrders')" class="portal-record-actions">
        <v-alert v-if="recordError" type="error" density="compact" class="mb-2">{{ recordError }}</v-alert>
        <v-btn v-if="route.name==='ZaloContactDetail'" size="small" color="primary" :loading="linking" @click="linkCustomer">Lưu vào khách hàng portal</v-btn>
        <v-btn v-else href="/orders" size="small" variant="outlined">Đơn hàng nghiệp vụ portal</v-btn>
      </div>
      <router-view :key="route.path" />
    </ZaloSalesLayout>
    <v-app v-else theme="light-apple">
      <v-container class="workspace-connection">
        <v-card class="pa-6" max-width="620">
          <div class="text-overline">CHUỖI CUNG ỨNG · CSKH OMNICHANNEL (ZALO &amp; WHATSAPP)</div>
          <h1 class="text-h5 mb-4">Khách hàng &amp; CSKH</h1>
          <v-alert v-if="error" type="warning" variant="tonal" class="mb-4">{{ error }}</v-alert>
          <p v-else class="mb-4">Đang mở không gian làm việc của thương hiệu…</p>
          <form v-if="brands.length" action="/brand-switch" method="post" class="mb-4">
            <input type="hidden" name="_token" :value="config.csrfToken" />
            <label for="sales-brand">Thương hiệu làm việc</label>
            <select id="sales-brand" name="brand_id" :value="config.activeBrandId || 'all'" @change="submitBrand"><option value="all">Tất cả Brand</option><option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option></select>
          </form>
          <v-btn v-if="error" @click="connect" :loading="loading" class="mr-2" color="primary">Kết nối lại</v-btn>
          <v-btn href="/dashboard" variant="text">Trở về portal</v-btn>
        </v-card>
      </v-container>
    </v-app>
  </v-defaults-provider>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { zaloDefaults } from '../themes';
import ZaloSalesLayout from './ZaloSalesLayout.vue';
import '../assets/workspace.css';
const route=useRoute(), auth=useAuthStore();
const ready=ref(false), loading=ref(false), error=ref('');
const linking=ref(false),recordError=ref('');
const config=(window as any).APP_CONFIG || {}, brands=config.brands || [];
const oldTitle=document.title;
const oldIcon=document.querySelector<HTMLLinkElement>("link[rel*='icon']")?.href;
document.body.classList.add('zalo-workspace');
document.documentElement.classList.add('zalo-workspace');
function submitBrand(event:Event){(event.target as HTMLSelectElement).form?.submit();}
async function connect(){loading.value=true;error.value='';try{await auth.init();ready.value=true;}catch(e){error.value=(e as Error).message;}finally{loading.value=false;}}
async function linkCustomer(){linking.value=true;recordError.value='';try{const response=await fetch(`/api/zalo-native/contacts/${route.params.id}`,{method:'POST',headers:{Accept:'application/json','X-CSRF-TOKEN':config.csrfToken}});const data=await response.json();if(!response.ok)throw new Error(data.message||'Không lưu được hồ sơ.');window.location.assign(data.url);}catch(e){recordError.value=(e as Error).message;}finally{linking.value=false;}}
onMounted(connect);
onUnmounted(()=>{
  document.body.classList.remove('zalo-workspace');
  document.documentElement.classList.remove('zalo-workspace');
  document.title=oldTitle;
  const icon=document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if(icon && oldIcon)icon.href=oldIcon;
});
</script>
<style scoped>
.workspace-connection{min-height:100vh;min-height:100dvh;padding:16px;display:flex;align-items:center;justify-content:center}
form label{display:block;font-size:12px;margin-bottom:6px}form select{font:inherit;width:100%;padding:10px;border:1px solid #d5dfd8;border-radius:8px}
.portal-record-actions{display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;flex-wrap:wrap}
</style>
