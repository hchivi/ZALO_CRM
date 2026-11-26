<template>
  <v-app theme="light">
    <v-main class="d-flex align-center justify-center" style="min-height: 100vh; background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);">
      <v-card class="pa-6 pa-sm-8 rounded-xl elevation-8" width="100%" max-width="440">
        <div class="text-center mb-6">
          <div class="d-inline-flex align-center justify-center rounded-circle mb-3" style="width: 56px; height: 56px; background: #0f766e;">
            <v-icon size="30" color="white">mdi-forum-outline</v-icon>
          </div>
          <h1 class="text-h5 font-weight-bold text-grey-darken-4">
            {{ isSetupMode ? 'Thiết lập CRM lần đầu' : 'Đăng nhập Zalo & WhatsApp CRM' }}
          </h1>
          <p class="text-body-2 text-grey-darken-1 mt-1">
            {{ isSetupMode ? 'Tạo tổ chức và tài khoản quản trị viên đầu tiên' : 'Hệ thống quản lý & chăm sóc khách hàng đa kênh' }}
          </p>
        </div>

        <v-alert v-if="errorMsg" type="error" variant="tonal" density="compact" class="mb-4">
          {{ errorMsg }}
        </v-alert>

        <v-form @submit.prevent="handleSubmit">
          <template v-if="isSetupMode">
            <v-text-field
              v-model="orgName"
              label="Tên công ty / Tổ chức"
              prepend-inner-icon="mdi-domain"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              required
            />
            <v-text-field
              v-model="fullName"
              label="Họ và tên Admin"
              prepend-inner-icon="mdi-account-outline"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              required
            />
          </template>

          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            prepend-inner-icon="mdi-email-outline"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            required
          />

          <v-text-field
            v-model="password"
            label="Mật khẩu"
            :type="showPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            variant="outlined"
            density="comfortable"
            class="mb-4"
            required
          />

          <v-btn
            type="submit"
            color="teal-darken-2"
            size="large"
            block
            rounded="lg"
            class="font-weight-bold text-none"
            :loading="submitting"
          >
            {{ isSetupMode ? 'Khởi tạo & Bắt đầu sử dụng' : 'Đăng nhập' }}
          </v-btn>
        </v-form>
      </v-card>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const isSetupMode = ref(false);
const orgName = ref('');
const fullName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const submitting = ref(false);
const errorMsg = ref('');

onMounted(async () => {
  isSetupMode.value = await authStore.checkSetup();
});

async function handleSubmit() {
  errorMsg.value = '';
  submitting.value = true;
  try {
    if (isSetupMode.value) {
      await authStore.setup(orgName.value.trim(), fullName.value.trim(), email.value.trim(), password.value);
    } else {
      await authStore.login(email.value.trim(), password.value);
    }
    router.replace('/cskh/chat');
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || err?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
  } finally {
    submitting.value = false;
  }
}
</script>
