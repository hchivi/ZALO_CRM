<template>
  <div class="contacts-view-wrapper">
    <!-- Header / Toolbar -->
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Khách hàng</h1>
        <p class="text-caption text-grey mb-0">Quản lý danh sách khách hàng, phân loại và tiến độ chăm sóc</p>
      </div>
      <div class="d-flex align-center flex-wrap" style="gap: 8px;">
        <v-btn-toggle
          v-model="viewMode"
          mandatory
          rounded="lg"
          density="compact"
          color="primary"
          variant="outlined"
          class="bg-surface"
        >
          <v-btn value="table" size="small" class="text-none">
            <v-icon start size="16">mdi-table</v-icon>
            Danh sách
          </v-btn>
          <v-btn value="kanban" size="small" class="text-none">
            <v-icon start size="16">mdi-view-column-outline</v-icon>
            Phễu Kanban
          </v-btn>
        </v-btn-toggle>

        <v-btn
          v-if="authStore.user?.role !== 'accountant'"
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-medium rounded-lg"
          elevation="0"
          @click="openCreate"
        >
          Thêm khách hàng
        </v-btn>
      </div>
    </div>

    <!-- Tab filters for Customer types -->
    <v-tabs
      v-model="activeTab"
      color="primary"
      class="mb-3 font-weight-bold"
      align-tabs="start"
      show-arrows
      height="44"
    >
      <v-tab value="all" class="text-none" @click="setAccountantFilter(false)">
        <v-icon start icon="mdi-account-group-outline" class="mr-1" />
        Tất cả khách hàng ({{ total }})
      </v-tab>
      <v-tab value="accountant" class="text-none" @click="setAccountantFilter(true)">
        <v-icon start icon="mdi-calculator" class="mr-1" />
        Khách chuyển Kế toán
      </v-tab>
    </v-tabs>

    <!-- Filters component -->
    <v-card class="pa-3 mb-3 rounded-lg filter-card" variant="outlined">
      <ContactFilters :filters="filters" @search="onFilterChange" />
    </v-card>

    <!-- Bulk Action Floating Bar -->
    <v-expand-transition>
      <div
        v-if="selectedRealContactCount > 0 && authStore.user?.role !== 'accountant'"
        class="bulk-action-bar pa-3 mb-3 d-flex flex-wrap align-center justify-space-between rounded-lg"
        style="gap: 8px;"
      >
        <div class="d-flex align-center">
          <v-icon icon="mdi-checkbox-marked-circle" color="primary" class="mr-2" size="20" />
          <span class="text-body-2 font-weight-medium">
            Đã chọn <strong class="text-primary">{{ selectedRealContactCount }}</strong> khách hàng
          </span>
        </div>
        <div class="d-flex align-center flex-wrap" style="gap: 8px;">
          <v-btn
            variant="text"
            size="small"
            class="text-none"
            @click="selected = []"
          >
            Bỏ chọn
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            size="small"
            prepend-icon="mdi-delete-outline"
            class="text-none font-weight-bold"
            :loading="deleting"
            @click="showBulkDeleteDialog = true"
          >
            Xoá {{ selectedRealContactCount }} khách hàng
          </v-btn>
        </div>
      </div>
    </v-expand-transition>

    <!-- Data table (View Mode: Table) -->
    <v-card v-if="viewMode === 'table'" variant="outlined" class="rounded-lg overflow-hidden">
      <v-data-table
        v-model="selected"
        :headers="headers"
        :items="contactsOrTransfers"
        :loading="loading"
        :items-per-page="pagination.limit"
        :items-length="activeTab === 'accountant' ? contactsOrTransfers.length : total"
        :show-select="authStore.user?.role !== 'accountant'"
        item-value="virtualId"
        hover
        density="comfortable"
        class="contacts-table"
        @click:row="onRowClick"
        @update:page="onPageChange"
        @update:items-per-page="onItemsPerPageChange"
      >
        <!-- Avatar -->
        <template #item.avatarUrl="{ item }">
          <v-avatar size="34" color="grey-lighten-2" class="cursor-pointer" @click.stop="goToDetail(item.id)">
            <v-img v-if="item.avatarUrl" :src="item.avatarUrl" />
            <v-icon v-else size="20">mdi-account</v-icon>
          </v-avatar>
        </template>

        <!-- Full Name with Link to Detail Page -->
        <template #item.fullName="{ item }">
          <div class="d-flex align-center">
            <router-link
              :to="`/cskh/contacts/${item.id}`"
              class="font-weight-medium text-decoration-none contact-link text-body-2"
              @click.stop
            >
              {{ item.fullName || 'Chưa đặt tên' }}
            </router-link>
            <v-tooltip text="Mở hồ sơ 360°" location="top">
              <template #activator="{ props }">
                <v-icon
                  v-bind="props"
                  icon="mdi-arrow-top-right-thin"
                  size="16"
                  class="ml-1 text-grey cursor-pointer link-icon"
                  @click.stop="goToDetail(item.id)"
                />
              </template>
            </v-tooltip>
          </div>
        </template>

        <!-- Phone -->
        <template #item.phone="{ item }">
          <a v-if="item.phone" :href="`tel:${item.phone}`" class="text-body-2 text-decoration-none text-foreground" @click.stop>
            {{ item.phone }}
          </a>
          <span v-else class="text-grey">—</span>
        </template>

        <!-- Source chip -->
        <template #item.source="{ item }">
          <v-chip v-if="item.source" size="small" variant="tonal" class="font-weight-medium">
            {{ sourceLabel(item.source) }}
          </v-chip>
          <span v-else class="text-grey">—</span>
        </template>

        <!-- Email -->
        <template #item.email="{ item }">
          <span v-if="item.email" class="text-body-2 text-truncate" style="max-width: 160px; display: inline-block;">
            {{ item.email }}
          </span>
          <span v-else class="text-grey">—</span>
        </template>

        <!-- Status chip -->
        <template #item.status="{ item }">
          <v-chip
            v-if="item.status"
            :color="statusColor(item.status)"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ statusLabel(item.status) }}
          </v-chip>
          <span v-else class="text-grey">—</span>
        </template>

        <!-- First contact date -->
        <template #item.firstContactDate="{ item }">
          <span class="text-body-2">
            {{ item.firstContactDate ? new Date(item.firstContactDate).toLocaleDateString('vi-VN') : '—' }}
          </span>
        </template>

        <!-- Assigned user (Sale) -->
        <template #item.assignedUser="{ item }">
          <span class="text-body-2">{{ item.assignedUser?.fullName ?? '—' }}</span>
        </template>

        <!-- Tracked delivery date countdown -->
        <template #item.trackedDeliveryDate="{ item }">
          <template v-if="(authStore.user?.role === 'accountant' ? (item.notes || '').includes('[Chuyển cho Kế toán]') : ((item.notes || '').includes('[Chuyển cho Kế toán]') || item.metadata?.customerCode)) && (authStore.user?.role === 'accountant' || item.metadata?.transferredByName === authStore.user?.fullName || authStore.isAdmin)">
            <div class="d-flex align-center flex-wrap gap-1">
              <v-chip
                v-if="item.metadata?.deliveryDate && item.metadata?.accountantStatus !== 'completed'"
                :color="getDeliveryDaysRemaining(item.metadata.deliveryDate).color"
                size="small"
                variant="tonal"
                class="font-weight-bold"
              >
                <v-icon start :icon="getDeliveryDaysRemaining(item.metadata.deliveryDate).icon" size="14" />
                {{ getDeliveryDaysRemaining(item.metadata.deliveryDate).text }}
              </v-chip>
              <span v-if="item.metadata?.deliveryDate" class="text-caption text-grey ml-1">
                {{ item.metadata?.accountantStatus === 'completed' ? 'Giao: ' : '' }}({{ formatDate(item.metadata.deliveryDate) }})
              </span>
            </div>
          </template>
          <span v-else class="text-grey">—</span>
        </template>

        <!-- Accountant status -->
        <template #item.accountantStatus="{ item }">
          <template v-if="(item.notes || '').includes('[Chuyển cho Kế toán]')">
            <div class="d-flex flex-column" style="gap: 2px;">
              <v-chip
                :color="item.metadata?.accountantStatus === 'completed' ? 'success' : 'warning'"
                size="x-small"
                variant="flat"
                class="font-weight-bold"
                style="width: fit-content;"
              >
                {{ item.metadata?.accountantStatus === 'completed' ? 'Đã đối soát' : 'Chờ đối soát' }}
              </v-chip>
              <span v-if="item.metadata?.transferredByName" class="text-grey" style="font-size: 0.65rem;">
                Bởi: {{ item.metadata.transferredByName }}
              </span>
            </div>
          </template>
          <span v-else class="text-grey">—</span>
        </template>

        <!-- Actions column -->
        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-end" @click.stop>
            <v-tooltip text="Hồ sơ chi tiết 360°" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-card-account-details-outline"
                  size="small"
                  variant="text"
                  color="primary"
                  @click.stop="goToDetail(item.id)"
                />
              </template>
            </v-tooltip>

            <v-tooltip text="Sửa nhanh" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-pencil-outline"
                  size="small"
                  variant="text"
                  color="grey-darken-1"
                  @click.stop="openEdit(item)"
                />
              </template>
            </v-tooltip>

            <!-- Thu hồi khỏi Kế toán nếu khách đang chuyển cho Kế toán -->
            <v-tooltip
              v-if="authStore.user?.role !== 'accountant' && (item.notes || '').includes('[Chuyển cho Kế toán]')"
              text="Thu hồi khỏi Kế toán (Hoàn tác)"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-undo"
                  size="small"
                  variant="text"
                  color="warning"
                  @click.stop="revokeAccountantTransfer(item)"
                />
              </template>
            </v-tooltip>

            <v-tooltip v-if="authStore.user?.role !== 'accountant'" text="Xoá khách hàng" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  color="error"
                  @click.stop="promptSingleDelete(item)"
                />
              </template>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Kanban Pipeline Board (View Mode: Kanban) -->
    <div v-else class="kanban-board-container pb-4">
      <div v-if="loading && pipeline.length === 0" class="d-flex justify-center py-12">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>

      <div v-else class="kanban-columns-track d-flex" style="gap: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; min-height: calc(100dvh - 280px); padding-bottom: 16px;">
        <div
          v-for="stage in canonicalPipeline"
          :key="stage.status"
          class="kanban-column flex-shrink-0 rounded-xl d-flex flex-column"
          :class="{ 'kanban-column-over': draggedOverStage === stage.status }"
          :style="{
            width: 'min(310px, calc(100vw - 44px))',
            background: 'rgba(var(--v-theme-surface-variant), 0.28)',
            borderTop: `4px solid ${stage.color}`,
            border: draggedOverStage === stage.status ? `2px dashed ${stage.color}` : '1px solid rgba(var(--v-border-color), var(--v-border-opacity))',
            borderRadius: '14px',
            transition: 'all 0.2s ease',
          }"
          @dragover.prevent="draggedOverStage = stage.status"
          @dragleave="draggedOverStage === stage.status ? draggedOverStage = null : null"
          @drop="onDrop(stage.status, $event)"
        >
          <!-- Column Header -->
          <div class="kanban-column-header pa-3 d-flex align-center justify-space-between border-b">
            <div class="d-flex align-center gap-2">
              <v-icon :icon="stage.icon" size="18" :style="{ color: stage.color }" />
              <span class="font-weight-bold text-body-2">{{ stage.text }}</span>
            </div>
            <v-chip size="x-small" :style="{ background: stage.color, color: '#fff' }" class="font-weight-bold px-2">
              {{ stage.contacts.length }}
            </v-chip>
          </div>

          <!-- Cards Scrollable Area -->
          <div class="kanban-cards-list pa-2 flex-grow-1 d-flex flex-column gap-2" style="overflow-y: auto; max-height: calc(100dvh - 350px); min-height: 200px;">
            <div
              v-if="stage.contacts.length === 0"
              class="empty-column-placeholder d-flex flex-column align-center justify-center py-8 text-center text-caption text-medium-emphasis border-dashed rounded-lg"
              style="border: 1px dashed rgba(var(--v-border-color), 0.5); min-height: 110px;"
            >
              <v-icon size="24" color="grey" class="mb-1">mdi-tray-arrow-down</v-icon>
              <span>Kéo thả hoặc bấm chuyển giai đoạn vào đây</span>
            </div>

            <v-card
              v-for="item in stage.contacts"
              :key="item.id"
              class="kanban-card pa-3 rounded-lg border cursor-pointer elevation-1"
              :draggable="authStore.user?.role !== 'accountant'"
              @dragstart="onDragStart(item, $event)"
              @click="goToDetail(item.id)"
              style="transition: transform 0.15s ease, box-shadow 0.15s ease; background: rgb(var(--v-theme-surface));"
            >
              <!-- Card Top: Avatar + Name + Action -->
              <div class="d-flex align-start justify-space-between mb-2" style="gap: 6px;">
                <div class="d-flex align-center gap-2" style="min-width: 0; flex: 1;">
                  <v-avatar size="32" color="grey-lighten-2" class="flex-shrink-0">
                    <v-img v-if="item.avatarUrl" :src="item.avatarUrl" />
                    <v-icon v-else size="18">mdi-account</v-icon>
                  </v-avatar>
                  <div style="min-width: 0; flex: 1;">
                    <div class="font-weight-bold text-body-2 text-truncate">
                      {{ item.fullName || 'Chưa đặt tên' }}
                    </div>
                    <div class="text-caption text-medium-emphasis font-mono text-truncate">
                      {{ item.phone || 'Chưa có SĐT' }}
                    </div>
                  </div>
                </div>

                <!-- Touch stage move + Chat shortcut -->
                <div class="d-flex align-center flex-shrink-0" style="gap: 2px;" @click.stop>
                  <v-menu v-if="authStore.user?.role !== 'accountant'" location="bottom end">
                    <template #activator="{ props: moveProps }">
                      <v-btn
                        v-bind="moveProps"
                        icon="mdi-swap-horizontal"
                        size="x-small"
                        variant="text"
                        color="grey-darken-1"
                        title="Chuyển giai đoạn"
                        aria-label="Chuyển giai đoạn khách hàng"
                        @click.stop
                      />
                    </template>
                    <v-list density="compact" min-width="190" max-width="calc(100vw - 24px)" rounded="lg">
                      <v-list-subheader class="text-caption font-weight-bold">Chuyển giai đoạn</v-list-subheader>
                      <v-list-item
                        v-for="targetStage in canonicalPipeline"
                        :key="targetStage.status"
                        :disabled="item.status === targetStage.status"
                        @click="moveContactToStage(item, targetStage.status)"
                      >
                        <template #prepend>
                          <v-icon :icon="targetStage.icon" size="16" :style="{ color: targetStage.color }" class="mr-2" />
                        </template>
                        <v-list-item-title class="text-caption font-weight-medium">{{ targetStage.text }}</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>

                  <v-btn
                    icon="mdi-chat-outline"
                    size="x-small"
                    variant="text"
                    color="primary"
                    title="Mở chat Zalo"
                    aria-label="Mở chat Zalo"
                    @click.stop="openChatWithContact(item)"
                  />
                </div>
              </div>

              <!-- Notes snippet if any -->
              <div v-if="item.notes" class="text-caption text-medium-emphasis text-truncate-2 mb-2 pa-1.5 rounded" style="background: rgba(var(--v-theme-surface-variant), 0.5); font-size: 0.75rem;">
                <v-icon size="12" class="mr-1">mdi-note-text-outline</v-icon>
                {{ item.notes }}
              </div>

              <!-- Card Bottom: Tags, Assigned, Orders -->
              <div class="d-flex align-center justify-space-between pt-1 border-t mt-1" style="font-size: 0.72rem;">
                <div class="d-flex align-center gap-1">
                  <v-chip v-if="item.assignedUser" size="x-small" variant="tonal" color="primary" class="px-1.5" style="height: 18px; font-size: 0.65rem;">
                    {{ item.assignedUser.fullName }}
                  </v-chip>
                  <v-chip v-if="item.metadata?.accountantStatus" size="x-small" :color="item.metadata.accountantStatus === 'completed' ? 'success' : 'warning'" variant="flat" class="px-1.5" style="height: 18px; font-size: 0.65rem;">
                    {{ item.metadata.accountantStatus === 'completed' ? 'Đã cọc' : 'Chờ cọc' }}
                  </v-chip>
                </div>

                <div class="d-flex align-center text-caption text-grey gap-2">
                  <span v-if="item._count?.orders" title="Số đơn hàng" class="d-flex align-center">
                    <v-icon size="13" class="mr-0.5">mdi-shopping-outline</v-icon>
                    {{ item._count.orders }}
                  </span>
                  <span v-if="item.updatedAt" class="text-caption" style="font-size: 0.65rem;">
                    {{ formatTimeAgo(item.updatedAt) }}
                  </span>
                </div>
              </div>
            </v-card>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Delete Confirmation Dialog -->
    <v-dialog v-model="showBulkDeleteDialog" max-width="480" persistent>
      <v-card class="rounded-xl pa-2">
        <v-card-title class="d-flex align-center text-error pt-4 px-4 pb-2">
          <v-icon icon="mdi-alert-circle-outline" class="mr-2" size="26" />
          <span class="font-weight-bold">Xác nhận xoá hàng loạt</span>
        </v-card-title>
        <v-card-text class="px-4 py-2 text-body-1">
          Bạn có chắc chắn muốn xoá vĩnh viễn <strong>{{ selectedRealContactCount }}</strong> khách hàng đã chọn không?
          <div class="mt-2 text-caption text-grey">
            Toàn bộ đơn hàng và lịch hẹn liên quan sẽ bị xoá cùng. Cuộc hội thoại Zalo sẽ được gỡ liên kết. Thao tác này không thể hoàn tác.
          </div>
        </v-card-text>
        <v-card-actions class="px-4 pb-4 pt-2 flex-wrap" style="gap: 8px;">
          <v-spacer />
          <v-btn variant="text" class="text-none" :disabled="deleting" @click="showBulkDeleteDialog = false">Huỷ bỏ</v-btn>
          <v-btn
            color="error"
            variant="flat"
            class="text-none font-weight-bold"
            :loading="deleting"
            @click="executeBulkDelete"
          >
            Xoá {{ selectedRealContactCount }} khách hàng
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Single Delete Confirmation Dialog -->
    <v-dialog v-model="showSingleDeleteDialog" max-width="450" persistent>
      <v-card class="rounded-xl pa-2">
        <v-card-title class="d-flex align-center text-error pt-4 px-4 pb-2">
          <v-icon icon="mdi-delete-alert-outline" class="mr-2" size="26" />
          <span class="font-weight-bold">Xác nhận xoá khách hàng</span>
        </v-card-title>
        <v-card-text class="px-4 py-2 text-body-1">
          Bạn có chắc muốn xoá khách hàng <strong>{{ itemToDelete?.fullName || 'này' }}</strong>?
        </v-card-text>
        <v-card-actions class="px-4 pb-4 pt-2 flex-wrap" style="gap: 8px;">
          <v-spacer />
          <v-btn variant="text" class="text-none" :disabled="deleting" @click="showSingleDeleteDialog = false">Huỷ</v-btn>
          <v-btn
            color="error"
            variant="flat"
            class="text-none font-weight-bold"
            :loading="deleting"
            @click="executeSingleDelete"
          >
            Xoá
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Contact detail/quick edit dialog -->
    <ContactDetailDialog
      v-model="showDialog"
      :contact="selectedContact"
      @saved="onSaved"
      @deleted="onDeleted"
    />

    <!-- Snackbar Notification -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="bottom right">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive } from 'vue';
import { useRoute, useRouter } from '@/modules/zalocrm/router-adapter';
import ContactFilters from '@/modules/zalocrm/components/contacts/ContactFilters.vue';
import ContactDetailDialog from '@/modules/zalocrm/components/contacts/ContactDetailDialog.vue';
import { useContacts, SOURCE_OPTIONS, STATUS_OPTIONS } from '@/modules/zalocrm/composables/use-contacts';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';
import type { Contact } from '@/modules/zalocrm/composables/use-contacts';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const {
  contacts, pipeline, total, loading, deleting, filters, pagination,
  fetchContacts, fetchPipeline, updateContactStatus, updateContact, deleteContact, deleteContacts
} = useContacts();

const viewMode = ref<'table' | 'kanban'>('table');
const draggedContact = ref<Contact | null>(null);
const draggedOverStage = ref<string | null>(null);

const showDialog = ref(false);
const selectedContact = ref<Contact | null>(null);
const activeTab = ref('all');

// Selection state
const selected = ref<string[]>([]);
const showBulkDeleteDialog = ref(false);
const showSingleDeleteDialog = ref(false);
const itemToDelete = ref<Contact | null>(null);

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success',
});

function showToast(text: string, color = 'success') {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
}

const contactsOrTransfers = computed(() => {
  if (activeTab.value !== 'accountant') {
    return contacts.value.map(c => ({ ...c, virtualId: c.id }));
  }
  
  const list: any[] = [];
  
  for (const contact of contacts.value) {
    // 1. Add historical transfers from history array
    const history = contact.metadata?.history || [];
    history.forEach((h: any, index: number) => {
      const codeRegex = / - [A-Z]+[0-9]+$/;
      const baseName = (contact.fullName || '').replace(codeRegex, '').trim();
      const codeSuffix = h.customerCode ? ` - ${h.customerCode}` : '';
      
      list.push({
        ...contact,
        virtualId: `${contact.id}-history-${index}`,
        fullName: `${baseName}${codeSuffix}`,
        metadata: {
          ...contact.metadata,
          accountantStatus: 'completed',
          transferredByName: h.transferredByName,
          transferredAt: h.transferredAt,
          accountantCompletedByName: h.accountantCompletedByName,
          accountantCompletedAt: h.accountantCompletedAt,
          deliveryDate: h.deliveryDate,
          customerCode: h.customerCode,
        },
        isHistoryRecord: true,
        historyIndex: index,
        notes: '[Chuyển cho Kế toán]'
      });
    });
    
    // 2. Add active transfer if it has the tag OR has customerCode
    const isAccountant = authStore.user?.role === 'accountant';
    const hasActiveTransfer = isAccountant
      ? (contact.notes || '').includes('[Chuyển cho Kế toán]')
      : ((contact.notes || '').includes('[Chuyển cho Kế toán]') || contact.metadata?.customerCode);

    if (hasActiveTransfer) {
      const activeMeta = contact.metadata || {};
      const codeRegex = / - [A-Z]+[0-9]+$/;
      const baseName = (contact.fullName || '').replace(codeRegex, '').trim();
      const codeSuffix = activeMeta.customerCode ? ` - ${activeMeta.customerCode}` : '';
      
      list.push({
        ...contact,
        virtualId: `${contact.id}-active`,
        fullName: `${baseName}${codeSuffix}`,
        isHistoryRecord: false,
      });
    }
  }
  
  return list.sort((a, b) => {
    const timeA = new Date(a.metadata?.transferredAt || 0).getTime();
    const timeB = new Date(b.metadata?.transferredAt || 0).getTime();
    return timeB - timeA;
  });
});

// Calculate unique real contact IDs selected
const selectedRealContactIds = computed(() => {
  const ids = new Set<string>();
  for (const item of contactsOrTransfers.value) {
    if (selected.value.includes(item.virtualId) && item.id) {
      ids.add(item.id);
    }
  }
  return Array.from(ids);
});

const selectedRealContactCount = computed(() => selectedRealContactIds.value.length);

function setAccountantFilter(val: boolean) {
  filters.accountantOnly = val;
  selected.value = [];
  onFilterChange();
}

watch(
  () => route.query.accountantOnly,
  (newVal) => {
    if (newVal === 'true') {
      activeTab.value = 'accountant';
      filters.accountantOnly = true;
    } else {
      activeTab.value = 'all';
      filters.accountantOnly = false;
    }
    selected.value = [];
    onFilterChange();
  }
);

const headers = [
  { title: '', key: 'avatarUrl', sortable: false, width: '48px' },
  { title: 'Tên khách hàng', key: 'fullName', sortable: true },
  { title: 'SĐT', key: 'phone', sortable: false },
  { title: 'Email', key: 'email', sortable: false },
  { title: 'Nguồn', key: 'source', sortable: false },
  { title: 'Trạng thái', key: 'status', sortable: false },
  { title: 'Ngày tiếp nhận', key: 'firstContactDate', sortable: true },
  { title: 'Đơn hàng đang theo dõi', key: 'trackedDeliveryDate', sortable: false },
  { title: 'Kế toán', key: 'accountantStatus', sortable: false },
  { title: 'Sale', key: 'assignedUser', sortable: false },
  { title: 'Thao tác', key: 'actions', sortable: false, align: 'end' as const, width: '130px' },
];

function sourceLabel(value: string) {
  return SOURCE_OPTIONS.find(o => o.value === value)?.text ?? value;
}

function statusLabel(value: string) {
  return STATUS_OPTIONS.find(o => o.value === value)?.text ?? value;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    new: '#2563EB',
    consulting: '#F59E0B',
    quoted: '#8B5CF6',
    waiting_deposit: '#EA580C',
    closed_deal: '#0D9488',
    completed: '#16A34A',
    lost: '#64748B',
    contacted: '#3B82F6',
    interested: '#F59E0B',
    converted: '#10B981',
  };
  return map[status] ?? '#64748B';
}

const canonicalPipeline = computed(() => {
  return STATUS_OPTIONS.filter(opt => ['new', 'consulting', 'quoted', 'waiting_deposit', 'closed_deal', 'completed', 'lost'].includes(opt.value)).map(opt => {
    const stageData = pipeline.value.find(p => p.status === opt.value);
    return {
      ...opt,
      status: opt.value,
      contacts: stageData?.contacts || [],
      count: stageData?.count || stageData?.contacts?.length || 0,
    };
  });
});

function onDragStart(contact: Contact, event: DragEvent) {
  draggedContact.value = contact;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', contact.id);
    event.dataTransfer.effectAllowed = 'move';
  }
}

async function moveContactToStage(contact: Contact, targetStatus: string) {
  if (!contact || contact.status === targetStatus) return;

  const oldStatus = contact.status;
  // Optimistic update in pipeline
  const sourceStage = pipeline.value.find(s => s.status === oldStatus);
  const targetStage = pipeline.value.find(s => s.status === targetStatus);

  if (sourceStage) {
    sourceStage.contacts = sourceStage.contacts.filter(c => c.id !== contact.id);
    sourceStage.count = Math.max(0, sourceStage.count - 1);
  }
  if (targetStage) {
    contact.status = targetStatus;
    targetStage.contacts.unshift(contact);
    targetStage.count = (targetStage.count || 0) + 1;
  }

  const success = await updateContactStatus(contact.id, targetStatus);
  if (success) {
    showToast(`Đã chuyển ${contact.fullName || 'khách hàng'} sang "${statusLabel(targetStatus)}"`, 'success');
  } else {
    showToast('Cập nhật trạng thái thất bại, vui lòng thử lại', 'error');
    fetchPipeline();
  }
}

async function onDrop(targetStatus: string, event: DragEvent) {
  event.preventDefault();
  draggedOverStage.value = null;
  const contact = draggedContact.value;
  draggedContact.value = null;
  if (!contact || contact.status === targetStatus) return;
  await moveContactToStage(contact, targetStatus);
}

function openChatWithContact(item: Contact) {
  router.push({ path: '/crm/cskh/chat', query: { contactId: item.id } });
}

function formatTimeAgo(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diffMinutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes}m trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d trước`;
}

watch(viewMode, (newVal) => {
  if (newVal === 'kanban') {
    fetchPipeline();
  } else {
    fetchContacts();
  }
});

function onFilterChange() {
  pagination.page = 1;
  fetchContacts();
}

function onPageChange(page: number) {
  pagination.page = page;
  fetchContacts();
}

function onItemsPerPageChange(limit: number) {
  pagination.limit = limit;
  pagination.page = 1;
  fetchContacts();
}

function openCreate() {
  selectedContact.value = null;
  showDialog.value = true;
}

function openEdit(item: Contact) {
  selectedContact.value = item;
  showDialog.value = true;
}

function onRowClick(_event: Event, row: { item: Contact }) {
  goToDetail(row.item.id);
}

function goToDetail(id: string) {
  if (!id) return;
  router.push(`/contacts/${id}`);
}

function promptSingleDelete(item: Contact) {
  itemToDelete.value = item;
  showSingleDeleteDialog.value = true;
}

async function revokeAccountantTransfer(item: any) {
  const tag = '[Chuyển cho Kế toán]';
  const chatTag = '[Kế toán được chat]';
  const currentNotes = (item.notes || '')
    .replace(tag, '')
    .replace(chatTag, '')
    .replace(/\n\n+/g, '\n')
    .trim();

  const meta = { ...(item.metadata || {}) };
  if (meta.accountantStatus === 'completed') {
    meta.history = meta.history || [];
    meta.history.push({
      transferredByName: meta.transferredByName || 'Staff',
      transferredAt: meta.transferredAt,
      accountantCompletedByName: meta.accountantCompletedByName || 'Kế toán',
      accountantCompletedAt: meta.accountantCompletedAt,
      deliveryDate: meta.deliveryDate,
      customerCode: meta.customerCode,
    });
  }
  delete meta.transferredByName;
  delete meta.transferredAt;
  delete meta.accountantStatus;
  delete meta.accountantCompletedByName;
  delete meta.accountantCompletedAt;
  delete meta.deliveryDate;

  const res = await updateContact(item.id, {
    notes: currentNotes || null,
    metadata: meta,
  });

  if (res) {
    showToast('Đã thu hồi khách hàng khỏi Kế toán thành công');
    fetchContacts();
  } else {
    showToast('Lỗi khi thu hồi khỏi Kế toán', 'error');
  }
}

async function executeSingleDelete() {
  if (!itemToDelete.value) return;
  const success = await deleteContact(itemToDelete.value.id);
  showSingleDeleteDialog.value = false;
  if (success) {
    showToast('Đã xoá khách hàng thành công');
    selected.value = selected.value.filter(id => id !== itemToDelete.value?.id);
  } else {
    showToast('Lỗi khi xoá khách hàng', 'error');
  }
  itemToDelete.value = null;
}

async function executeBulkDelete() {
  const ids = selectedRealContactIds.value;
  if (ids.length === 0) return;
  const count = ids.length;
  const success = await deleteContacts(ids);
  showBulkDeleteDialog.value = false;
  if (success) {
    selected.value = [];
    showToast(`Đã xoá thành công ${count} khách hàng`);
  } else {
    showToast('Có lỗi xảy ra khi xoá khách hàng hàng loạt', 'error');
  }
}

function onSaved() {
  fetchContacts();
}

function onDeleted() {
  fetchContacts();
}

onMounted(() => {
  if (route.query.accountantOnly === 'true') {
    activeTab.value = 'accountant';
    filters.accountantOnly = true;
  } else {
    activeTab.value = 'all';
    filters.accountantOnly = false;
  }
  fetchContacts();
});

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN');
}

function getDeliveryDaysRemaining(deliveryDateStr: string | null | undefined): { days: number; text: string; color: string; icon: string } {
  if (!deliveryDateStr) return { days: 0, text: '—', color: 'grey', icon: '' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const delivery = new Date(deliveryDateStr + 'T00:00:00');
  
  const diffTime = delivery.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      days: diffDays,
      text: `Trễ ${overdue} ngày`,
      color: 'error',
      icon: 'mdi-alert-circle'
    };
  } else if (diffDays === 0) {
    return {
      days: diffDays,
      text: 'Giao hôm nay!',
      color: 'warning',
      icon: 'mdi-clock-alert'
    };
  } else {
    return {
      days: diffDays,
      text: `Còn ${diffDays} ngày`,
      color: 'success',
      icon: 'mdi-clock-outline'
    };
  }
}
</script>

<style scoped>
.contacts-view-wrapper {
  padding-bottom: 24px;
}

.filter-card {
  border-color: rgba(var(--v-border-color), 0.15) !important;
}

.bulk-action-bar {
  background-color: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
}

.contact-link {
  color: rgb(var(--v-theme-on-surface));
  transition: color 0.15s ease;
}

.contact-link:hover {
  color: rgb(var(--v-theme-primary));
}

.link-icon {
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.link-icon:hover {
  opacity: 1;
}

.contacts-table :deep(tr:hover) {
  cursor: pointer;
}
</style>
