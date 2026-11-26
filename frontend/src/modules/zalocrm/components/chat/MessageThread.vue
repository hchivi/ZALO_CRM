<template>
  <div
    class="message-thread d-flex flex-column flex-grow-1 position-relative"
    style="height: 100%;"
    @dragenter="handleContainerDragEnter"
    @dragover.prevent="handleContainerDragOver"
    @dragleave="handleContainerDragLeave"
    @drop.prevent="handleContainerDrop"
  >
    <!-- Empty state -->
    <div v-if="!conversation" class="d-flex align-center justify-center flex-grow-1">
      <div class="text-center text-grey">
        <v-icon icon="mdi-chat-outline" size="96" color="grey-lighten-2" />
        <p class="text-h6 mt-4">Chọn cuộc trò chuyện</p>
      </div>
    </div>

    <template v-else>
      <!-- ── Zalo Drag & Drop File/Image Overlay (Image 1) ── -->
      <ChatDropzone
        :visible="isDraggingFile && canChat"
        :dragged-file-label="draggedFileLabel"
        @drop-quick="onDropQuickSend"
        @drop-preview="onDropPreviewSend"
      />

      <!-- Header -->
      <div class="pa-2 pa-sm-3 d-flex align-center chat-header" style="gap: 4px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); background: rgb(var(--v-theme-surface));">
        <v-btn
          v-if="isMobile"
          icon="mdi-arrow-left"
          variant="text"
          size="small"
          class="mr-0 mr-sm-1 flex-shrink-0"
          aria-label="Quay lại danh sách"
          @click="$emit('back')"
        />
        <div style="position: relative; display: inline-block;" :class="isMobile ? 'mr-2 flex-shrink-0' : 'mr-3 flex-shrink-0'">
          <v-avatar size="36" color="grey-lighten-2">
            <v-img v-if="conversation.contact?.avatarUrl" :src="conversation.contact.avatarUrl" cover referrerpolicy="no-referrer">
              <template #error>
                <v-icon v-if="conversation.threadType === 'group'" icon="mdi-account-group" />
                <v-icon v-else icon="mdi-account" />
              </template>
            </v-img>
            <v-icon v-else-if="conversation.threadType === 'group'" icon="mdi-account-group" />
            <v-icon v-else icon="mdi-account" />
          </v-avatar>
          <!-- Channel badge: WhatsApp (green) vs Zalo (official logo) -->
          <div
            v-if="conversation.channel === 'whatsapp' || conversation.zaloAccount?.channel === 'whatsapp'"
            style="position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); border: 1.5px solid white; background: #25D366;"
            title="WhatsApp"
          >
            <v-icon size="10" color="white">mdi-whatsapp</v-icon>
          </div>
          <div
            v-else
            style="position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); border: 1.5px solid white; background: #0068FF; overflow: hidden;"
            title="Zalo"
          >
            <img :src="zaloLogoUrl" alt="Zalo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          </div>
        </div>
        <div class="flex-grow-1" style="min-width: 0;">
          <div class="d-flex align-center flex-wrap" style="gap: 6px;">
            <span class="font-weight-medium text-body-2 text-sm-body-1 text-truncate" style="max-width: 100%;">{{ conversation.contact?.fullName || 'Unknown' }}</span>
                  <!-- Cần theo dõi Toggle Button (cho nhóm chat) -->
            <v-btn
              v-if="conversation.threadType === 'group'"
              :color="effectiveIsCustomer ? 'error' : 'warning'"
              :variant="effectiveIsCustomer ? 'flat' : 'outlined'"
              size="x-small"
              rounded="xl"
              class="text-none px-2 font-weight-bold"
              style="height: 22px; font-size: 0.7rem;"
              :prepend-icon="effectiveIsCustomer ? 'mdi-bell-ring' : 'mdi-bell-outline'"
              :loading="updatingQuote"
              @click="toggleGroupTracking"
            >
              {{ effectiveIsCustomer ? 'Đang theo dõi' : 'Cần theo dõi?' }}
            </v-btn>

            <!-- Trạng thái khách hàng (Customer Status Dropdown Chip) -->
            <v-menu location="bottom start" offset="4">
              <template #activator="{ props: statusMenuProps }">
                <v-chip
                  v-bind="statusMenuProps"
                  size="x-small"
                  variant="outlined"
                  class="font-weight-bold cursor-pointer status-header-chip"
                  :style="{
                    color: getStatusMeta(currentCustomerStatus).color,
                    borderColor: getStatusMeta(currentCustomerStatus).color + '60',
                    backgroundColor: getStatusMeta(currentCustomerStatus).color + '18',
                    height: '24px',
                    fontSize: '0.72rem'
                  }"
                >
                  <v-icon start size="14" class="mr-1">{{ getStatusMeta(currentCustomerStatus).icon }}</v-icon>
                  {{ getStatusMeta(currentCustomerStatus).text }}
                  <v-icon end size="12" class="ml-1 opacity-70">mdi-chevron-down</v-icon>
                </v-chip>
              </template>
              <v-card rounded="xl" elevation="8" class="pa-1.5" min-width="210">
                <div class="text-caption font-weight-bold px-2 py-1 text-medium-emphasis">Trạng thái khách hàng</div>
                <v-divider class="mb-1 opacity-20" />
                <v-list density="compact" nav class="pa-0">
                  <v-list-item
                    v-for="st in CUSTOMER_STATUSES"
                    :key="st.id"
                    rounded="lg"
                    class="status-select-item mb-0.5 cursor-pointer"
                    :class="{ 'is-active-status': getStatusMeta(currentCustomerStatus).id === st.id }"
                    @click="updateCustomerStatus(st.id)"
                  >
                    <template #prepend>
                      <v-icon size="17" :color="st.color" class="mr-2">{{ st.icon }}</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2 font-weight-medium">
                      {{ st.label }}
                    </v-list-item-title>
                    <template #append v-if="getStatusMeta(currentCustomerStatus).id === st.id">
                      <v-icon size="16" color="primary">mdi-check</v-icon>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-menu>

            <!-- Contact Role Badge in Header -->
            <v-chip
              v-if="contactRoleTag === 'Khách hàng'"
              size="small"
              color="success"
              variant="tonal"
              class="font-weight-bold ml-1.5 cursor-pointer"
              style="height: 24px; font-size: 0.72rem;"
              @click="quickTagMenuOpen = true"
            >
              <v-icon start size="13" class="mr-0.5" color="#16A34A">mdi-account-check</v-icon>
              Khách hàng
            </v-chip>
            <v-chip
              v-else-if="contactRoleTag === 'Nhà cung cấp'"
              size="small"
              color="warning"
              variant="tonal"
              class="font-weight-bold ml-1.5 cursor-pointer"
              style="height: 24px; font-size: 0.72rem;"
              @click="quickTagMenuOpen = true"
            >
              <v-icon start size="13" class="mr-0.5" color="#EA580C">mdi-truck-delivery-outline</v-icon>
              Nhà cung cấp
            </v-chip>
            <v-chip
              v-else-if="contactRoleTag === 'Nội bộ công ty'"
              size="small"
              color="blue-grey"
              variant="tonal"
              class="font-weight-bold ml-1.5 cursor-pointer"
              style="height: 24px; font-size: 0.72rem;"
              @click="quickTagMenuOpen = true"
            >
              <v-icon start size="13" class="mr-0.5" color="#64748B">mdi-domain</v-icon>
              Nội bộ
            </v-chip>
          </div>
          <div class="d-flex align-center mt-1">
            <span class="text-caption text-grey">{{ conversation.zaloAccount?.displayName || 'Zalo' }}</span>
            <v-chip
              v-if="conversation.isMuted"
              size="x-small"
              class="ml-2 font-weight-medium muted-chip"
              style="height: 18px; font-size: 0.65rem;"
            >
              <v-icon start size="10" class="mr-1">mdi-bell-off-outline</v-icon>
              Tắt thông báo
            </v-chip>
            <v-chip
              v-if="conversation.zaloAccount?.status === 'disconnected'"
              size="x-small"
              color="grey-darken-2"
              variant="flat"
              class="ml-2 font-weight-bold text-white"
              style="height: 18px; font-size: 0.65rem;"
            >
              Đã ngắt kết nối
            </v-chip>
          </div>
        </div>

        <div class="d-flex align-center flex-shrink-0 chat-header-actions" style="gap: 2px;">
        <!-- Quick Tag / Phân loại nhanh Button with Popup Menu (Image 3) -->
        <v-menu location="bottom end" :close-on-content-click="false" v-model="quickTagMenuOpen">
          <template #activator="{ props: tagProps }">
            <v-btn
              v-bind="tagProps"
              :icon="quickTagMenuOpen || currentContactTags.length ? 'mdi-tag-multiple' : 'mdi-tag-multiple-outline'"
              size="small"
              variant="text"
              :density="isMobile ? 'compact' : 'default'"
              title="Phân loại nhanh (Chọn nhiều nhãn)"
              aria-label="Phân loại nhanh"
              :color="quickTagMenuOpen || currentContactTags.length ? 'primary' : undefined"
            />
          </template>
          <v-card min-width="240" max-width="calc(100vw - 24px)" rounded="xl" elevation="10" class="pa-2 category-popup-card">
            <div class="d-flex align-center justify-space-between px-2 py-1 mb-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis" style="letter-spacing: 0.5px;">Phân loại nhanh</span>
              <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-medium">
                {{ currentContactTags.length }} nhãn
              </v-chip>
            </div>
            <v-divider class="mb-1" />
            <v-list density="compact" nav class="pa-0">
              <v-list-item
                v-for="cat in CONVERSATION_CATEGORIES"
                :key="cat.title"
                @click="toggleContactTag(cat.title)"
                rounded="lg"
                class="category-select-item mb-1 cursor-pointer"
                :class="{ 'is-selected': currentContactTags.includes(cat.title) || (cat.title === 'KH quan trọng' && currentContactTags.includes('Khách hàng quan trọng')) }"
              >
                <template #prepend>
                  <v-icon :icon="cat.icon" :style="{ color: cat.color }" size="18" class="mr-2.5" />
                </template>
                <v-list-item-title class="text-body-2 font-weight-medium">
                  {{ cat.title }}
                </v-list-item-title>
                <template #append>
                  <v-icon
                    v-if="currentContactTags.includes(cat.title) || (cat.title === 'KH quan trọng' && currentContactTags.includes('Khách hàng quan trọng'))"
                    icon="mdi-check-circle"
                    size="19"
                    color="#2E5C43"
                  />
                  <v-icon
                    v-else
                    icon="mdi-plus-circle-outline"
                    size="19"
                    class="text-medium-emphasis opacity-40"
                  />
                </template>
              </v-list-item>

              <!-- + Tạo nhãn mới (Image 4) -->
              <v-divider class="my-1" />
              <v-list-item
                rounded="lg"
                class="category-select-item cursor-pointer"
                @click="openCreateTagDialog"
              >
                <template #prepend>
                  <v-icon icon="mdi-plus" color="#16A34A" size="18" class="mr-2.5" />
                </template>
                <v-list-item-title class="text-body-2 font-weight-medium text-success">
                  Tạo nhãn mới
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>

        <!-- Nút Ghim Lưu ý KH / Đơn hàng -->
        <v-btn
          :icon="currentPinnedNote ? 'mdi-pin' : 'mdi-pin-outline'"
          size="small"
          variant="text"
          :density="isMobile ? 'compact' : 'default'"
          :title="currentPinnedNote ? 'Chỉnh sửa lưu ý đã ghim' : 'Ghim lưu ý khách hàng / đơn hàng'"
          :color="currentPinnedNote ? 'amber-darken-3' : undefined"
          @click="openNoteDialog"
        />

        <!-- Quản trị Nhóm Chat Button (Chỉ hiện khi là Group) -->
        <v-btn
          v-if="conversation.threadType === 'group'"
          :icon="showGroupDrawer ? 'mdi-account-cog' : 'mdi-account-cog-outline'"
          size="small"
          variant="text"
          :density="isMobile ? 'compact' : 'default'"
          title="Quản trị nhóm Zalo"
          :color="showGroupDrawer ? 'primary' : undefined"
          @click="showGroupDrawer = !showGroupDrawer"
        />

        <!-- Gọi Điện Thoại Button (Chỉ hiện khi là chat 1-1 với khách) -->
        <v-btn
          v-if="conversation.threadType !== 'group'"
          icon="mdi-phone-outline"
          size="small"
          variant="text"
          :density="isMobile ? 'compact' : 'default'"
          title="Gọi điện thoại cho khách hàng"
          color="success"
          @click="openCallDialog"
        />

        <!-- Thông tin KH Button -->
        <v-btn
          :icon="showContactPanel ? 'mdi-account-details' : 'mdi-account-details-outline'"
          size="small" variant="text"
          :density="isMobile ? 'compact' : 'default'"
          title="Thông tin khách hàng"
          :color="showContactPanel ? 'primary' : undefined"
          @click="$emit('toggle-contact-panel')"
        />
        </div>
      </div>

      <aside v-if="currentPinnedNote" class="pinned-note-strip" :class="{ 'pinned-note-vip': currentCustomerStatus === 'vip' || currentCustomerStatus === 'completed', 'pinned-note-urgent': currentCustomerStatus === 'warning', 'pinned-note-dark': noteIsDark }" aria-label="Ghi chú nội bộ đã ghim">
        <v-icon size="16" class="pin-icon" aria-hidden="true">mdi-pin-outline</v-icon>
        <div class="pinned-note-body">
          <button type="button" class="pinned-note-copy" title="Xem và chỉnh sửa ghi chú" @click="openNoteDialog">
            <span class="pinned-note-badge">Ghi chú nội bộ</span>
            <span ref="pinnedNotePreview" class="note-text-preview" :class="{ 'note-text-expanded': noteExpanded }">{{ currentPinnedNote }}</span>
          </button>
          <button v-if="noteOverflows || noteExpanded" type="button" class="note-expand-btn" :aria-expanded="noteExpanded" @click="noteExpanded = !noteExpanded">{{ noteExpanded ? 'Thu gọn' : 'Xem thêm' }}<v-icon size="12">{{ noteExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon></button>
        </div>
        <div class="pinned-note-actions">
          <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" class="note-action-btn" title="Chỉnh sửa ghi chú" aria-label="Chỉnh sửa ghi chú" @click="openNoteDialog" />
          <v-btn icon="mdi-close" size="x-small" variant="text" class="note-action-btn" title="Gỡ ghi chú này" aria-label="Gỡ ghi chú này" :loading="savingNote" @click="clearPinnedNote" />
        </div>
      </aside>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-grow-1 overflow-y-auto pa-3 chat-messages-area" @scroll="onMessagesContainerScroll">
        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" />

        <!-- Nút tải thêm tin nhắn cũ hơn -->
        <div v-if="hasOlderMessages" class="text-center my-3">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            rounded="pill"
            :loading="loadingOlder"
            class="text-caption font-weight-bold px-4"
            prepend-icon="mdi-history"
            @click="triggerLoadOlder"
          >
            Tải thêm tin nhắn cũ hơn
          </v-btn>
        </div>
        <template v-for="(msg, index) in messages" :key="msg.id">
          <!-- Date divider header -->
          <div v-if="shouldShowDateDivider(index)" class="d-flex align-center justify-center my-4" style="width: 100%;">
            <div class="flex-grow-1 date-divider-line"></div>
            <div class="mx-3 text-caption px-3 py-1 rounded-pill date-divider-chip">
              {{ formatDateDivider(msg.sentAt) }}
            </div>
            <div class="flex-grow-1 date-divider-line"></div>
          </div>

          <div
            v-if="!isEmptyMediaJson(msg)"
            :id="`msg-${msg.id}`"
            class="mb-2 d-flex message-row position-relative align-end"
            :class="[
              msg.senderType === 'self' ? 'justify-end' : 'justify-start',
              { 'multi-select-mode-active': isMultiSelectMode }
            ]"
            @click="isMultiSelectMode ? toggleMsgSelect(msg) : undefined"
          >
            <!-- Checkbox when in multi-select mode -->
            <div
              v-if="isMultiSelectMode"
              class="d-flex align-center mr-2 flex-shrink-0 cursor-pointer mb-2"
              style="order: 0;"
              @click.stop="toggleMsgSelect(msg)"
            >
              <v-checkbox-btn
                :model-value="selectedMsgIds.has(msg.id)"
                color="primary"
                density="compact"
              />
            </div>

            <!-- OUTSIDE ACTION BUTTONS (Image 2 & Image 3) -->
            <div
              v-if="!msg.isDeleted && !isMultiSelectMode"
              class="message-outside-actions d-flex align-center mb-1.5"
              :style="{
                order: msg.senderType === 'self' ? 1 : 2,
                marginLeft: msg.senderType === 'self' ? '0' : (isMobile ? '4px' : '8px'),
                marginRight: msg.senderType === 'self' ? (isMobile ? '4px' : '8px') : '0',
              }"
            >
              <!-- 1. Trả lời (Quote ❝) -->
              <button type="button" class="msg-outside-btn" title="Trả lời tin nhắn" aria-label="Trả lời tin nhắn" @click.stop="startReply(msg)">
                <v-icon size="14">mdi-format-quote-close</v-icon>
              </button>

              <!-- 2. Chuyển tiếp (Forward ➜) -->
              <button type="button" class="msg-outside-btn" title="Chuyển tiếp" aria-label="Chuyển tiếp tin nhắn" @click.stop="startForward(msg)">
                <v-icon size="14">mdi-share</v-icon>
              </button>

              <!-- 3. Ba chấm ... (Menu Image 4) -->
              <v-menu
                :location="msg.senderType === 'self' ? 'top end' : 'top start'"
                :close-on-content-click="true"
                offset="6"
              >
                <template #activator="{ props: menuProps }">
                  <button type="button" class="msg-outside-btn" title="Thêm tùy chọn" aria-label="Thêm tùy chọn tin nhắn" v-bind="menuProps" @click.stop>
                    <v-icon size="14">mdi-dots-horizontal</v-icon>
                  </button>
                </template>

                <v-list density="compact" class="py-1 message-zalo-menu-list rounded-xl" elevation="10" min-width="190" max-width="calc(100vw - 24px)">
                  <!-- Copy tin nhắn -->
                  <v-list-item density="compact" class="zalo-menu-item" @click="copyMessageContent(msg)">
                    <template #prepend><v-icon size="17" class="mr-2.5">mdi-content-copy</v-icon></template>
                    <v-list-item-title class="text-caption font-weight-medium">Copy tin nhắn</v-list-item-title>
                  </v-list-item>

                  <!-- Ghim tin nhắn -->
                  <v-list-item density="compact" class="zalo-menu-item" @click="pinMessage(msg)">
                    <template #prepend><v-icon size="17" class="mr-2.5">mdi-pin-outline</v-icon></template>
                    <v-list-item-title class="text-caption font-weight-medium">Ghim tin nhắn</v-list-item-title>
                  </v-list-item>

                  <!-- Đánh dấu tin nhắn -->
                  <v-list-item density="compact" class="zalo-menu-item" @click="starMessage(msg)">
                    <template #prepend><v-icon size="17" class="mr-2.5">mdi-star-outline</v-icon></template>
                    <v-list-item-title class="text-caption font-weight-medium">Đánh dấu tin nhắn</v-list-item-title>
                  </v-list-item>

                  <!-- Chọn nhiều tin nhắn -->
                  <v-list-item density="compact" class="zalo-menu-item" @click="enterMultiSelectMode(msg)">
                    <template #prepend><v-icon size="17" class="mr-2.5">mdi-format-list-checks</v-icon></template>
                    <v-list-item-title class="text-caption font-weight-medium">Chọn nhiều tin nhắn</v-list-item-title>
                  </v-list-item>

                  <!-- Xem chi tiết -->
                  <v-list-item density="compact" class="zalo-menu-item" @click="showMessageDetails(msg)">
                    <template #prepend><v-icon size="17" class="mr-2.5">mdi-information-outline</v-icon></template>
                    <v-list-item-title class="text-caption font-weight-medium">Xem chi tiết</v-list-item-title>
                  </v-list-item>

                  <!-- Tuỳ chọn khác (Tạo nhắc hẹn, Thu hồi) -->
                  <v-menu :location="isMobile ? 'bottom' : (msg.senderType === 'self' ? 'start top' : 'end top')" :open-on-hover="!isMobile" :open-on-click="true" :close-on-content-click="true" offset="4">
                    <template #activator="{ props: subMenuProps }">
                      <v-list-item density="compact" class="zalo-menu-item" v-bind="subMenuProps" @click.stop>
                        <template #prepend><v-icon size="17" class="mr-2.5">mdi-dots-horizontal-circle-outline</v-icon></template>
                        <v-list-item-title class="text-caption font-weight-medium">Tuỳ chọn khác</v-list-item-title>
                        <template #append><v-icon size="14">mdi-chevron-right</v-icon></template>
                      </v-list-item>
                    </template>
                    <v-list density="compact" class="py-1 message-zalo-menu-list rounded-xl" elevation="10" min-width="170" max-width="calc(100vw - 24px)">
                      <v-list-item density="compact" class="zalo-menu-item" @click="openAppointmentDialog(msg)">
                        <template #prepend><v-icon size="16" class="mr-2">mdi-calendar-clock</v-icon></template>
                        <v-list-item-title class="text-caption font-weight-medium">Tạo nhắc hẹn</v-list-item-title>
                      </v-list-item>
                      <v-list-item
                        v-if="msg.senderType === 'self' && !msg.isDeleted"
                        density="compact"
                        class="zalo-menu-item menu-item-danger"
                        @click="handleRecall(msg)"
                      >
                        <template #prepend><v-icon size="16" class="mr-2 action-danger-icon">mdi-backup-restore</v-icon></template>
                        <v-list-item-title class="text-caption font-weight-medium action-danger-text">Thu hồi</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>

                  <v-divider class="my-1 opacity-20" />

                  <!-- Xóa chỉ ở phía tôi -->
                  <v-list-item density="compact" class="zalo-menu-item menu-item-danger" @click="handleDeleteOnlyMe(msg)">
                    <template #prepend><v-icon size="17" class="mr-2.5 action-danger-icon">mdi-delete-outline</v-icon></template>
                    <v-list-item-title class="text-caption font-weight-medium action-danger-text">Xóa chỉ ở phía tôi</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>

            <!-- Group member sender avatar (left of message bubble) -->
            <v-avatar
              v-if="conversation.threadType === 'group' && msg.senderType !== 'self'"
              size="28"
              class="mr-2 mb-1 flex-shrink-0 align-self-end elevation-1"
              color="grey-lighten-2"
              style="order: 0;"
              :title="msg.senderName || 'Thành viên nhóm'"
            >
              <v-img v-if="getSenderAvatar(msg)" :src="getSenderAvatar(msg) || undefined" cover referrerpolicy="no-referrer" />
              <span v-else class="text-caption font-weight-bold" style="font-size: 11px;">
                {{ (msg.senderName || 'U').trim()[0] }}
              </span>
            </v-avatar>

            <div class="message-wrapper position-relative" :style="{ order: msg.senderType === 'self' ? 2 : 1 }">
              <div v-if="conversation.threadType === 'group' && msg.senderType !== 'self'" class="text-caption mb-1 font-weight-medium text-primary">
                {{ msg.senderName || 'Unknown' }}
              </div>
              <div
                class="message-bubble position-relative"
                :class="[
                  msg.senderType === 'self' ? 'staff-bubble' : 'customer-bubble',
                  getStickerUrl(msg)
                    ? 'pa-0 sticker-bubble'
                    : (getContactCardInfo(msg)
                        ? 'pa-0 contact-card-bubble'
                        : (getImageUrl(msg) ? 'pa-0 image-bubble' : 'pa-3 px-4')),
                  getImageUrl(msg) && msg.senderType === 'self' ? 'image-bubble-self' : '',
                  getContactCardInfo(msg) && msg.senderType === 'self' ? 'contact-bubble-self' : ''
                ]"
                style="word-wrap: break-word;"
                @dblclick.stop="onCornerBadgeClick(msg)"
              >
                <!-- Forwarded Header Tag -->
                <div v-if="getForwardInfo(msg)" class="forwarded-tag mb-1.5 d-flex align-center">
                  <v-icon size="12" class="mr-1" style="opacity: 0.75;">mdi-share-outline</v-icon>
                  <span class="text-caption font-italic" style="font-size: 0.72rem; opacity: 0.85;">
                    Đã chuyển tiếp{{ getForwardInfo(msg)?.originalSender ? ` từ ${getForwardInfo(msg)?.originalSender}` : '' }}
                  </span>
                </div>

                <!-- Quoted Reply Box (Hiển thị nội dung mà user phản hồi lại) -->
                <div
                  v-if="getQuoteInfo(msg)"
                  class="quote-reply-box mb-2 cursor-pointer"
                  @click="scrollToQuotedMessage(getQuoteInfo(msg))"
                  title="Nhấn để xem tin nhắn gốc"
                >
                  <div class="quote-reply-content">
                    <div class="quote-reply-author">
                      <v-icon size="11" class="mr-1">mdi-reply</v-icon>
                      <span>{{ getQuoteInfo(msg)?.fromD || 'Tin nhắn trả lời' }}</span>
                    </div>
                    <div class="quote-reply-snippet">
                      {{ getQuoteSnippet(getQuoteInfo(msg)) }}
                    </div>
                  </div>
                </div>

                <!-- Deleted -->
                <div v-if="msg.isDeleted" class="recalled-message-box d-flex align-center font-italic text-medium-emphasis py-1" style="opacity: 0.8; gap: 6px;">
                  <v-icon size="16" class="opacity-70">mdi-delete-clock-outline</v-icon>
                  <span class="text-body-2">{{ getDeletedDisplay(msg) }}</span>
                </div>

                <!-- Call notification card -->
                <div v-else-if="getCallInfo(msg)" class="call-card pa-2.5 rounded-lg border d-flex align-center" :class="getCallInfo(msg)!.isMissed ? 'call-missed' : 'call-answered'" :style="{ borderLeftColor: getCallInfo(msg)!.color, borderLeftWidth: '4px' }">
                  <v-avatar size="38" :color="getCallInfo(msg)!.color" class="mr-3 flex-shrink-0" style="color: white !important;">
                    <v-icon size="20" color="white">{{ getCallInfo(msg)!.icon }}</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="d-flex align-center justify-space-between">
                      <span class="text-body-2 font-weight-bold" :style="{ color: getCallInfo(msg)!.isMissed ? '#EF4444' : 'inherit' }">
                        {{ getCallInfo(msg)!.title }}
                      </span>
                      <v-chip
                        v-if="getCallInfo(msg)!.isMissed"
                        size="x-small"
                        color="error"
                        variant="flat"
                        class="font-weight-bold px-1.5 ml-2"
                        style="height: 18px; font-size: 0.62rem;"
                      >
                        NHỠ
                      </v-chip>
                    </div>
                    <div class="text-caption mt-0.5" style="opacity: 0.8; font-size: 0.75rem;">
                      {{ getCallInfo(msg)!.subtitle }}
                    </div>
                  </div>
                </div>

                <!-- Voice message player (Tin nhắn thoại - ưu tiên trước Image) -->
                <div v-else-if="getVoiceInfo(msg)" class="voice-card pa-2.5 rounded-lg border d-flex align-center" :class="msg.senderType === 'self' ? 'voice-card-self' : 'voice-card-contact'">
                  <v-btn
                    :icon="isCurrentVoicePlaying(msg) ? 'mdi-pause' : 'mdi-play'"
                    size="small"
                    :color="msg.senderType === 'self' ? 'white' : 'primary'"
                    :variant="msg.senderType === 'self' ? 'tonal' : 'flat'"
                    class="mr-2.5 flex-shrink-0"
                    elevation="1"
                    :loading="isVoiceLoading(msg)"
                    @click.stop="togglePlayVoice(msg)"
                  />
                  <div class="flex-grow-1 mr-2" style="min-width: 100px;">
                    <!-- Waveform / Progress bar -->
                    <div
                      class="voice-progress-bar rounded-pill cursor-pointer"
                      title="Nhấn để tua âm thanh"
                      @click.stop="seekVoice($event, msg)"
                    >
                      <div
                        class="voice-progress-fill rounded-pill"
                        :style="{ width: `${getVoiceProgressPercent(msg)}%` }"
                      ></div>
                    </div>
                    <div class="d-flex align-center justify-space-between mt-1" style="font-size: 0.68rem; opacity: 0.85;">
                      <span class="font-weight-medium">
                        {{ isCurrentVoicePlaying(msg) || (activeVoiceMsgId === msg.id && voiceCurrentTime > 0) ? formatVoiceTime(voiceCurrentTime) : (getVoiceInfo(msg)!.durationText || '0:00') }}
                      </span>
                      <span class="d-flex align-center" style="gap: 2px;">
                        <v-icon size="11">mdi-microphone</v-icon>
                        <span>Thoại</span>
                      </span>
                    </div>
                  </div>
                  <!-- Download voice button -->
                  <v-btn
                    v-if="getVoiceInfo(msg)!.url"
                    icon="mdi-download"
                    size="x-small"
                    variant="text"
                    title="Tải tệp ghi âm"
                    @click.stop="downloadVoice(msg)"
                  />
                </div>

                <!-- File/PDF (Card v2 with Quick View & Download buttons) -->
                <div
                  v-else-if="getFileInfo(msg)"
                  class="file-card-v2"
                  :class="msg.senderType === 'self' ? 'file-card-self' : 'file-card-contact'"
                >
                  <div class="file-card-main">
                    <div class="file-badge" :class="`file-badge-${getFileTypeCategory(getFileInfo(msg)!.ext)}`">
                      <v-icon size="24">{{ getFileIcon(getFileInfo(msg)!.ext) }}</v-icon>
                    </div>
                    <div class="file-info-col">
                      <div class="file-title-text" :title="getFileInfo(msg)!.name">
                        {{ getFileInfo(msg)!.name }}
                      </div>
                      <div class="file-meta-row">
                        <span v-if="getFileInfo(msg)!.size" class="file-size-text">{{ getFileInfo(msg)!.size }}</span>
                        <span class="file-ext-tag">{{ (getFileInfo(msg)!.ext || 'FILE').toUpperCase() }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="file-card-actions">
                    <button
                      v-if="getFileInfo(msg)!.isViewable"
                      type="button"
                      class="file-action-btn file-action-view"
                      title="Xem nhanh tệp trong tab mới"
                      @click.stop="quickViewFile(getFileInfo(msg)!)"
                    >
                      <v-icon size="14" class="mr-1">mdi-eye-outline</v-icon>
                      <span>Xem nhanh</span>
                    </button>
                    <button
                      type="button"
                      class="file-action-btn file-action-download"
                      title="Tải tệp về máy tính"
                      @click.stop="downloadChatFile(getFileInfo(msg)!)"
                    >
                      <v-icon size="14" class="mr-1">mdi-download</v-icon>
                      <span>Tải về</span>
                    </button>
                  </div>
                </div>

                <!-- Video Player / Card -->
                <div v-else-if="getVideoInfo(msg)" class="video-message-box">
                  <div class="video-wrapper position-relative rounded-lg overflow-hidden" style="max-width: min(320px, 100%); width: 100%; background: #000;">
                    <video
                      v-if="getVideoInfo(msg)!.url"
                      :src="getVideoInfo(msg)!.url"
                      :poster="getVideoInfo(msg)!.thumb"
                      controls
                      playsinline
                      preload="metadata"
                      class="w-100 rounded-lg"
                      style="max-height: 280px; display: block;"
                      @click.stop
                    ></video>
                    <div
                      v-else-if="getVideoInfo(msg)!.thumb"
                      class="position-relative d-flex align-center justify-center cursor-pointer"
                      style="min-height: 160px;"
                      @click.stop="openImagePreviewDirect(getVideoInfo(msg)!.thumb, 'Video')"
                    >
                      <img :src="getVideoInfo(msg)!.thumb" alt="Video thumbnail" class="w-100" style="object-fit: cover; max-height: 220px;" />
                      <v-btn icon="mdi-play" size="large" color="primary" class="position-absolute" elevation="3" />
                    </div>
                    <div v-else class="pa-4 text-center text-white d-flex flex-column align-center">
                      <v-icon size="32" class="mb-1">mdi-video</v-icon>
                      <span class="text-caption">Video</span>
                    </div>
                  </div>
                  <div v-if="getVideoInfo(msg)!.caption" class="chat-image-caption mt-1.5">
                    {{ getVideoInfo(msg)!.caption }}
                  </div>
                </div>

                <!-- Sticker Zalo / WhatsApp (hiển thị không viền) -->
                <div v-else-if="getStickerUrl(msg)" class="sticker-message-container py-1">
                  <img
                    :src="getStickerUrl(msg)!"
                    alt="Sticker"
                    class="zalo-sticker-img"
                    loading="lazy"
                    @click.stop="openImagePreviewDirect(getStickerUrl(msg)!, 'Sticker')"
                    title="Nhấn để phóng to sticker"
                  />
                </div>

                <!-- Image -->
                <div v-else-if="getRenderImageUrl(msg)">
                  <div
                    v-if="isChatImageFailed(msg)"
                    class="pa-3 rounded-lg border d-flex align-center text-caption text-medium-emphasis"
                    style="gap: 8px; background: rgba(var(--v-theme-surface), 0.92);"
                  >
                    <v-icon size="18">mdi-image-off-outline</v-icon>
                    <span>Không tải được hình ảnh</span>
                  </div>
                  <img
                    v-else
                    :src="getRenderImageUrl(msg)!"
                    alt="Hình ảnh"
                    class="chat-image"
                    @click="openImagePreview(msg)"
                    @error="onChatImageError(msg)"
                    loading="lazy"
                    decoding="async"
                  />
                  <!-- Lời nhắn kèm ảnh -->
                  <div
                    v-if="getImageCaption(msg)"
                    class="chat-image-caption mt-2"
                  >
                    {{ getImageCaption(msg) }}
                  </div>
                </div>

                <!-- Bank Card & VietQR -->
                <div v-else-if="getBankCardInfo(msg)" class="bank-card-bubble pa-3 rounded-xl border" style="max-width: min(320px, 100%); width: 100%; background: rgba(var(--v-theme-surface), 0.95);">
                  <div class="d-flex align-center justify-space-between mb-2">
                    <div class="d-flex align-center" style="gap: 6px;">
                      <v-avatar size="28" color="primary" variant="tonal" rounded="lg">
                        <v-icon size="16" color="primary">mdi-bank</v-icon>
                      </v-avatar>
                      <span class="text-caption font-weight-bold text-truncate" style="max-width: 170px;">
                        {{ getBankCardInfo(msg)!.bankName }}
                      </span>
                    </div>
                    <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-bold" style="font-size: 0.65rem;">
                      Napas247
                    </v-chip>
                  </div>

                  <div v-if="getBankCardInfo(msg)!.vietQrUrl" class="text-center my-2 cursor-pointer" @click="openImagePreviewDirect(getBankCardInfo(msg)!.vietQrUrl!)" title="Nhấn để phóng to mã VietQR">
                    <img
                      :src="getBankCardInfo(msg)!.vietQrUrl!"
                      alt="VietQR"
                      class="rounded-lg border"
                      style="max-width: 170px; height: auto; box-shadow: 0 2px 10px rgba(0,0,0,0.06);"
                      loading="lazy"
                    />
                    <div class="text-caption mt-1" style="font-size: 0.68rem; opacity: 0.7;">
                      <v-icon size="11">mdi-magnify-plus-outline</v-icon> Bấm để phóng to QR
                    </div>
                  </div>

                  <div class="bank-details-box pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface-variant), 0.35); font-size: 0.78rem;">
                    <div class="d-flex align-center justify-space-between mb-1">
                      <span class="text-caption text-medium-emphasis">Số TK:</span>
                      <div class="d-flex align-center" style="gap: 4px;">
                        <span class="font-weight-bold text-primary" style="letter-spacing: 0.5px;">
                          {{ getBankCardInfo(msg)!.numAccBank }}
                        </span>
                        <v-btn
                          icon="mdi-content-copy"
                          size="x-small"
                          variant="text"
                          density="compact"
                          color="primary"
                          title="Sao chép số tài khoản"
                          @click.stop="copyToClipboard(getBankCardInfo(msg)!.numAccBank, 'số tài khoản')"
                        />
                      </div>
                    </div>

                    <div class="d-flex align-center justify-space-between mb-1">
                      <span class="text-caption text-medium-emphasis">Chủ TK:</span>
                      <span class="font-weight-bold text-truncate" style="max-width: 180px;">
                        {{ getBankCardInfo(msg)!.nameAccBank }}
                      </span>
                    </div>

                    <div v-if="getBankCardInfo(msg)!.amount && getBankCardInfo(msg)!.amount! > 0" class="d-flex align-center justify-space-between mb-1">
                      <span class="text-caption text-medium-emphasis">Số tiền:</span>
                      <span class="font-weight-bold text-success">
                        {{ getBankCardInfo(msg)!.amount!.toLocaleString('vi-VN') }} đ
                      </span>
                    </div>

                    <div v-if="getBankCardInfo(msg)!.note" class="d-flex align-center justify-space-between">
                      <span class="text-caption text-medium-emphasis">Nội dung:</span>
                      <span class="font-weight-medium text-truncate" style="max-width: 180px;">
                        {{ getBankCardInfo(msg)!.note }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Contact Card (Zalo Business Card matching Image 4) -->
                <div v-else-if="getContactCardInfo(msg)" class="zalo-contact-card-v4">
                  <!-- Upper body: Deep royal blue gradient with avatar and QR -->
                  <div class="zalo-card-top">
                    <!-- Left: Avatar + Name + Phone -->
                    <div class="d-flex align-center flex-grow-1 overflow-hidden" style="gap: 12px; z-index: 1;">
                      <v-avatar size="48" class="elevation-2 flex-shrink-0" style="border: 2px solid rgba(255, 255, 255, 0.85); background: #167a4c;">
                        <v-img v-if="getContactCardInfo(msg)!.avatar" :src="getContactCardInfo(msg)!.avatar" cover />
                        <span v-else class="text-subtitle-1 font-weight-bold text-white">{{ (getContactCardInfo(msg)!.name || 'U')[0] }}</span>
                      </v-avatar>
                      <div class="overflow-hidden">
                        <div class="text-subtitle-1 font-weight-bold text-white text-truncate" style="line-height: 1.25;">
                          {{ getContactCardInfo(msg)!.name }}
                        </div>
                        <div class="text-caption font-weight-medium text-truncate mt-0.5" style="color: rgba(255, 255, 255, 0.85); font-size: 0.85rem;">
                          {{ getContactCardInfo(msg)!.phone || 'Danh thiếp Zalo' }}
                        </div>
                      </div>
                    </div>

                    <!-- Right: QR Code box (clickable to zoom) -->
                    <div
                      class="zalo-card-qr-box flex-shrink-0 cursor-pointer"
                      @click.stop="openImagePreviewDirect(getContactQrFallback(getContactCardInfo(msg)!), `Mã QR Zalo - ${getContactCardInfo(msg)!.name}`)"
                      title="Nhấn để phóng to mã QR"
                      style="z-index: 1;"
                    >
                      <img
                        :src="getContactQrFallback(getContactCardInfo(msg)!)"
                        alt="QR Code"
                        class="zalo-card-qr-img"
                      />
                    </div>
                  </div>

                  <!-- Bottom footer: Dark navy bar with 2 action buttons -->
                  <div class="zalo-card-footer d-flex align-center">
                    <button
                      type="button"
                      class="zalo-card-btn"
                      @click.stop="onContactCall(getContactCardInfo(msg)!.phone)"
                      :disabled="!getContactCardInfo(msg)!.phone"
                    >
                      Gọi Điện
                    </button>
                    <div class="zalo-card-divider"></div>
                    <button
                      type="button"
                      class="zalo-card-btn"
                      @click.stop="onContactMessage(getContactCardInfo(msg)!)"
                    >
                      Nhắn Tin
                    </button>
                  </div>
                </div>

                <div v-else-if="msg.contentType === 'gif'">GIF</div>

                <!-- Reminder/Calendar -->
                <div v-else-if="isReminderMessage(msg)" class="reminder-card">
                  <div class="d-flex align-center mb-1">
                    <v-icon size="16" color="warning" class="mr-1">mdi-calendar-clock</v-icon>
                    <span class="text-caption font-weight-bold" style="color: #FFB74D;">Nhắc hẹn</span>
                  </div>
                  <div class="text-body-2">{{ getReminderTitle(msg) }}</div>
                  <div v-if="getReminderTime(msg)" class="text-caption mt-1" style="opacity: 0.7;">
                    <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>{{ getReminderTime(msg) }}
                  </div>
                  <v-btn size="x-small" variant="tonal" color="warning" class="mt-2" prepend-icon="mdi-calendar-sync" @click="syncAppointment(msg)">
                    Đồng bộ lịch
                  </v-btn>
                </div>

                <!-- Link preview (Format matching Image 2) -->
                <div v-else-if="getLinkInfo(msg)" class="link-preview-v2">
                  <!-- Line 1: Clickable Full URL -->
                  <a
                    :href="getLinkInfo(msg)!.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link-url-text"
                  >
                    {{ getLinkInfo(msg)!.url }}
                  </a>

                  <!-- Line 2: Bold Title -->
                  <div
                    v-if="getLinkInfo(msg)!.title && getLinkInfo(msg)!.title !== getLinkInfo(msg)!.url"
                    class="link-title-text"
                  >
                    <a
                      :href="getLinkInfo(msg)!.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-decoration-none"
                      style="color: inherit;"
                    >
                      {{ getLinkInfo(msg)!.title }}
                    </a>
                  </div>

                  <!-- Line 3: Description snippet -->
                  <div
                    v-if="getLinkInfo(msg)!.description && getLinkInfo(msg)!.description !== getLinkInfo(msg)!.title"
                    class="link-desc-text"
                  >
                    {{ getLinkInfo(msg)!.description }}
                  </div>

                  <!-- Line 4: Clickable domain -->
                  <div class="link-domain-text">
                    <a
                      :href="getLinkInfo(msg)!.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link-domain-link"
                    >
                      {{ formatLinkDomain(getLinkInfo(msg)!) }}
                    </a>
                  </div>
                </div>
                <!-- Default text -->
                <div v-else class="message-text" v-html="renderMessageText(msg.content, msg)"></div>

                <!-- Auto-detected Phone Number Banner / Action Chip -->
                <div v-if="!msg.isDeleted && detectPhoneNumber(msg.content)" class="detected-phone-strip mt-2 pt-1.5 border-t border-opacity-15 d-flex align-center justify-space-between flex-wrap" style="gap: 6px; background: rgba(0, 135, 90, 0.08); padding: 4px 8px; border-radius: 8px;">
                  <span class="text-caption d-flex align-center font-weight-bold" style="font-size: 0.72rem; color: #00875a;">
                    <v-icon size="13" class="mr-1">mdi-phone-check</v-icon>
                    SĐT phát hiện: {{ detectPhoneNumber(msg.content) }}
                  </span>
                  <v-btn
                    size="x-small"
                    color="success"
                    variant="flat"
                    class="text-none font-weight-bold px-2"
                    style="height: 22px; font-size: 0.68rem;"
                    @click.stop="quickSaveDetectedPhone(detectPhoneNumber(msg.content)!)"
                  >
                    Lưu vào hồ sơ
                  </v-btn>
                </div>
                <!-- Timestamp row underneath chat content -->
                <div class="text-caption mt-1.5 msg-time d-flex align-center justify-space-between" :class="msg.senderType === 'self' ? 'msg-time-self' : 'msg-time-contact'" style="font-size: 0.7rem; gap: 8px;">
                  <!-- Left side: Staff badge (if self) -->
                  <div class="d-flex align-center" style="gap: 6px;">
                    <span
                      v-if="msg.senderType === 'self' && (msg.repliedBy || msg.senderName)"
                      class="px-2 py-0.5 rounded text-white text-caption font-weight-bold"
                      :style="{ backgroundColor: getStaffColor(msg.repliedBy?.fullName || msg.senderName), fontSize: '0.62rem', borderRadius: '4px !important', letterSpacing: '0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }"
                    >
                      {{ (msg.repliedBy?.fullName || (String(msg.senderName).toLowerCase() === 'adameva' ? 'Eva' : msg.senderName) || 'AI').toUpperCase() }}
                    </span>
                  </div>

                  <!-- Right side: Timestamp -->
                  <span class="msg-timestamp">{{ formatMessageTime(msg.sentAt) }}</span>
                </div>

                <!-- Corner Quick Reaction Badge -->
                <v-menu
                  v-if="!msg.isDeleted"
                  :open-on-hover="!isMobile"
                  :open-on-click="!!isMobile"
                  location="top center"
                  :close-on-content-click="true"
                  :open-delay="80"
                  :close-delay="220"
                  offset="4"
                  transition="scale-transition"
                >
                  <template #activator="{ props: reactionActivatorProps }">
                    <button
                      type="button"
                      v-bind="reactionActivatorProps"
                      class="message-reaction-corner-badge"
                      :class="{
                        'has-reaction': !!getMessageReaction(msg),
                        'is-unreacted': !getMessageReaction(msg),
                        'badge-self': msg.senderType === 'self'
                      }"
                      :aria-label="getMessageReaction(msg) ? `Cảm xúc tin nhắn: ${getMessageReaction(msg)}` : 'Thả cảm xúc tin nhắn'"
                      :title="getMessageReaction(msg) ? `Cảm xúc: ${getMessageReaction(msg)} (Bấm để gỡ, rê chuột chọn biểu cảm khác)` : 'Bấm để thả tim ❤️ ngay, hoặc rê chuột để chọn biểu cảm khác'"
                      @click.stop="!isMobile && onCornerBadgeClick(msg)"
                    >
                      <span v-if="getMessageReaction(msg)" class="corner-reaction-emoji">
                        {{ getMessageReaction(msg) }}
                      </span>
                      <v-icon v-else size="13" class="corner-reaction-default-icon">
                        mdi-heart-outline
                      </v-icon>
                    </button>
                  </template>

                  <div
                    class="d-flex align-center px-2 py-1 rounded-pill elevation-6 reaction-picker-bar"
                    style="gap: 6px; border: 1px solid rgba(var(--v-border-color), 0.15);"
                    @click.stop
                  >
                    <button
                      v-for="r in reactionList"
                      :key="r.name"
                      class="reaction-emoji-btn"
                      :title="r.title"
                      @click.stop="applyMsgReaction(msg, r.emoji)"
                    >
                      {{ r.emoji }}
                    </button>
                  </div>
                </v-menu>
              </div>
            </div>
          </div>
        </template>
        <div v-if="!loading && messages.length === 0" class="text-center pa-8 text-grey">Chưa có tin nhắn</div>
      </div>

      <!-- Disconnected Zalo account notice banner -->
      <div
        v-if="conversation.zaloAccount?.status === 'disconnected'"
        class="px-3 py-2 text-center bg-surface-variant text-caption text-medium-emphasis d-flex align-center justify-center"
        style="border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); gap: 6px;"
      >
        <v-icon size="16" color="warning">mdi-alert-circle-outline</v-icon>
        <span>Tài khoản Zalo này hiện đang ngắt kết nối. Bạn đang xem lại toàn bộ lịch sử tin nhắn.</span>
      </div>

      <!-- Reply Preview Banner (above input) -->
      <div
        v-if="replyingTo && canChat"
        class="reply-preview-banner px-4 py-2 d-flex align-center justify-space-between"
      >
        <div class="d-flex align-center text-truncate" style="gap: 10px; flex: 1;">
          <div class="reply-indicator-bar"></div>
          <v-icon size="18" color="primary">mdi-reply</v-icon>
          <div class="text-truncate" style="flex: 1;">
            <div class="text-caption font-weight-bold text-primary d-flex align-center" style="gap: 4px;">
              <span>Đang trả lời {{ replyingTo.senderType === 'self' ? 'chính bạn' : (replyingTo.senderName || 'khách hàng') }}</span>
            </div>
            <div class="text-caption text-truncate text-medium-emphasis">
              {{ getMessageSnippet(replyingTo) }}
            </div>
          </div>
        </div>
        <v-btn
          icon="mdi-close"
          size="x-small"
          variant="text"
          title="Hủy trả lời"
          @click="cancelReply"
        />
      </div>

      <!-- Multi-select Bottom Action Bar -->
      <div
        v-if="isMultiSelectMode"
        class="multi-select-bar px-3 px-sm-4 py-2 d-flex flex-wrap align-center justify-space-between"
        style="gap: 8px;"
      >
        <div class="d-flex align-center" style="gap: 10px;">
          <v-btn icon="mdi-close" variant="text" size="small" @click="exitMultiSelect" title="Hủy chọn" />
          <span class="text-body-2 font-weight-medium">
            Đã chọn <strong class="text-primary">{{ selectedMsgIds.size }}</strong> tin nhắn
          </span>
        </div>
        <div class="d-flex flex-wrap align-center" style="gap: 8px;">
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            rounded="lg"
            prepend-icon="mdi-share"
            :disabled="selectedMsgIds.size === 0"
            @click="openForwardSelectedModal"
          >
            Chuyển tiếp ({{ selectedMsgIds.size }})
          </v-btn>
          <v-btn
            class="delete-for-me-btn"
            variant="outlined"
            size="small"
            rounded="lg"
            prepend-icon="mdi-delete-outline"
            :disabled="selectedMsgIds.size === 0"
            @click="deleteSelectedMessagesForMe"
          >
            Xóa ở phía tôi
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            rounded="lg"
            @click="exitMultiSelect"
          >
            Hủy
          </v-btn>
        </div>
      </div>

      <!-- Input / Warning Banner (Bố cục chuẩn Zalo PC giống Image 1) -->
      <div v-else-if="canChat" class="chat-composer-box">
        <!-- ── Hàng 1: Toolbar công cụ giống Image 1 ── -->
        <div class="chat-toolbar d-flex align-center px-3 py-1.5" style="gap: 10px;">
          <v-chip
            v-if="authStore.user?.role === 'accountant'"
            size="x-small"
            color="amber-darken-3"
            variant="tonal"
            class="font-weight-medium"
            prepend-icon="mdi-shield-check-outline"
          >
            {{ conversation?.threadType === 'group' ? 'Kế toán (Nhóm làm việc)' : 'Kế toán (Được bàn giao)' }}
          </v-chip>

          <!-- 1. Sticker / Biểu cảm -->
          <v-menu location="top start" :close-on-content-click="false">
            <template #activator="{ props: emojiMenuProps }">
              <button class="toolbar-btn" title="Biểu cảm & Nhãn dán" v-bind="emojiMenuProps">
                <v-icon size="19">mdi-emoticon-outline</v-icon>
              </button>
            </template>
            <v-card rounded="xl" elevation="6" class="pa-2 border" style="max-width: min(290px, calc(100vw - 16px));">
              <div class="text-caption font-weight-bold px-1 mb-1.5 text-medium-emphasis">Biểu cảm thường dùng</div>
              <div class="d-flex flex-wrap" style="gap: 6px;">
                <button
                  v-for="e in commonEmojis"
                  :key="e"
                  class="reaction-emoji-btn"
                  @click="insertEmoji(e)"
                >
                  {{ e }}
                </button>
              </div>
            </v-card>
          </v-menu>

          <!-- 2. Gửi hình ảnh -->
          <button
            class="toolbar-btn"
            :disabled="sending || sendingFile"
            title="Gửi hình ảnh từ Kho"
            @click="showMediaPicker = true"
          >
            <v-icon size="19">mdi-image-outline</v-icon>
          </button>

          <!-- 3. Đính kèm tệp -->
          <button
            class="toolbar-btn"
            :disabled="sending || sendingFile"
            title="Đính kèm file từ máy tính"
            @click="triggerFileInput"
          >
            <v-icon size="19">mdi-paperclip</v-icon>
          </button>
          <input type="file" ref="fileInput" class="d-none" accept="image/*, application/pdf, .doc, .docx, .xls, .xlsx, .txt, .zip, .rar" @change="handleFileChange" />

          <!-- Ghi âm tin nhắn thoại -->
          <button
            class="toolbar-btn"
            :class="{ 'text-error font-weight-bold': isRecordingVoice }"
            :disabled="sending || sendingFile"
            title="Ghi âm gửi tin nhắn thoại"
            @click="isRecordingVoice ? cancelVoiceRecording() : startVoiceRecording()"
          >
            <v-icon size="19" :color="isRecordingVoice ? 'error' : undefined">{{ isRecordingVoice ? 'mdi-microphone-off' : 'mdi-microphone' }}</v-icon>
          </button>

          <!-- 4. Gửi Danh thiếp -->
          <button
            class="toolbar-btn"
            :disabled="sending || sendingFile"
            title="Gửi Danh thiếp Zalo"
            @click="showContactCardModal = true"
          >
            <v-icon size="19">mdi-card-account-details-outline</v-icon>
          </button>

          <!-- 7. Tin nhắn nhanh (Icon sấm sét trong tin nhắn) -->
          <QuickRepliesMenu
            @select="onSelectQuickReply"
            @send-instant="onSendInstantQuickReply"
          />

          <!-- 8. Thẻ ngân hàng & QR -->
          <button
            class="toolbar-btn"
            :disabled="sending || sendingFile"
            title="Gửi Thẻ ngân hàng & VietQR"
            @click="showBankCardModal = true"
          >
            <v-icon size="19">mdi-credit-card-outline</v-icon>
          </button>

          <!-- 9. Nút Ba Chấm ... (Menu popup nổi bật chuẩn Image 1) -->
          <v-menu location="top start" offset="6">
            <template #activator="{ props: moreMenuProps }">
              <button class="toolbar-btn toolbar-more-active-btn" title="Thêm tùy chọn" v-bind="moreMenuProps">
                <v-icon size="18">mdi-dots-horizontal</v-icon>
              </button>
            </template>
            <v-list density="compact" class="py-1.5 zalo-popup-menu" rounded="xl" elevation="10" min-width="240" max-width="calc(100vw - 24px)">
              <!-- Tạo nhắc hẹn -->
              <v-list-item
                density="compact"
                class="zalo-popup-item cursor-pointer"
                @click="showZaloReminderModal = true"
              >
                <template #prepend>
                  <v-icon size="19" class="mr-3" color="amber-darken-2">mdi-alarm</v-icon>
                </template>
                <v-list-item-title class="text-body-2 font-weight-medium">Tạo nhắc hẹn</v-list-item-title>
              </v-list-item>

              <!-- Đánh dấu tin quan trọng -->
              <v-list-item
                density="compact"
                class="zalo-popup-item cursor-pointer"
                @click="markImportantMessage"
              >
                <template #prepend>
                  <v-icon size="19" class="mr-3" color="error">mdi-exclamation-thick</v-icon>
                </template>
                <v-list-item-title class="text-body-2 font-weight-medium">Đánh dấu tin quan trọng</v-list-item-title>
                <template #append>
                  <v-icon size="15" class="opacity-50">mdi-help-circle-outline</v-icon>
                </template>
              </v-list-item>

              <!-- Đánh dấu tin khẩn cấp -->
              <v-list-item
                density="compact"
                class="zalo-popup-item cursor-pointer"
                @click="markUrgentMessage"
              >
                <template #prepend>
                  <v-icon size="19" class="mr-3" color="deep-orange-darken-1">mdi-bell-outline</v-icon>
                </template>
                <v-list-item-title class="text-body-2 font-weight-medium">Đánh dấu tin khẩn cấp</v-list-item-title>
                <template #append>
                  <v-icon size="15" class="opacity-50">mdi-help-circle-outline</v-icon>
                </template>
              </v-list-item>

              <!-- Nếu là Group: Tạo bình chọn Poll -->
              <template v-if="conversation.threadType === 'group'">
                <v-divider class="my-1 opacity-20" />
                <v-list-item
                  density="compact"
                  class="zalo-popup-item cursor-pointer"
                  @click="showPollModal = true"
                >
                  <template #prepend>
                    <v-icon size="19" class="mr-3" color="info">mdi-poll</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2 font-weight-medium">Tạo bình chọn nhóm</v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>
        </div>

        <!-- Voice recording active banner -->
        <div v-if="isRecordingVoice" class="voice-recording-banner d-flex flex-wrap align-center justify-space-between px-3 py-2 mx-2 mx-sm-3 mb-2 rounded-xl bg-red-lighten-5 border border-error" style="gap: 8px;">
          <div class="d-flex align-center" style="gap: 10px;">
            <span class="recording-pulse-dot"></span>
            <span class="text-caption font-weight-bold text-error">Đang ghi âm thoại...</span>
            <span class="text-caption font-weight-bold ml-2 text-error font-mono">{{ formatVoiceDuration(recordingDuration) }}</span>
          </div>
          <div class="d-flex align-center" style="gap: 8px;">
            <v-btn size="small" variant="text" color="grey-darken-1" density="compact" @click="cancelVoiceRecording">
              Hủy
            </v-btn>
            <v-btn size="small" variant="flat" color="error" density="compact" prepend-icon="mdi-send" @click="sendVoiceRecording">
              Gửi thoại
            </v-btn>
          </div>
        </div>

        <!-- ── Hàng 2: Ô soạn thảo tin nhắn & Action bên phải giống Image 1 ── -->
        <div class="chat-input-row d-flex align-end px-3 pb-2 pt-1" style="gap: 8px;">
          <v-textarea
            v-model="inputText"
            :placeholder="isMobile ? 'Nhập tin nhắn...' : (chatRecipientName ? `Nhập tin nhắn tới ${chatRecipientName}...` : 'Nhập tin nhắn...')"
            variant="plain"
            density="compact"
            hide-details
            auto-grow
            rows="1"
            max-rows="6"
            aria-label="Soạn tin nhắn"
            class="chat-native-textarea flex-grow-1"
            @input="handleInputTyping"
            @keydown.enter.exact.prevent="handleSend"
          />

          <!-- Action bên phải ô nhập: Icon mặt cười & Like / Send -->
          <div class="d-flex align-center flex-shrink-0" style="gap: 6px; margin-bottom: 2px;">
            <v-menu location="top end" :close-on-content-click="false">
              <template #activator="{ props: subEmojiProps }">
                <button class="toolbar-btn" title="Chèn biểu cảm" v-bind="subEmojiProps">
                  <v-icon size="20">mdi-emoticon-outline</v-icon>
                </button>
              </template>
              <v-card rounded="xl" elevation="6" class="pa-2 border" style="max-width: min(290px, calc(100vw - 16px));">
                <div class="text-caption font-weight-bold px-1 mb-1.5 text-medium-emphasis">Biểu cảm</div>
                <div class="d-flex flex-wrap" style="gap: 6px;">
                  <button
                    v-for="e in commonEmojis"
                    :key="e"
                    class="reaction-emoji-btn"
                    @click="insertEmoji(e)"
                  >
                    {{ e }}
                  </button>
                </div>
              </v-card>
            </v-menu>

            <!-- Khi KHÔNG CÓ chữ: Nút Like màu vàng y hệt Image 1 -->
            <button
              v-if="!inputText.trim()"
              class="like-quick-btn"
              title="Gửi nhanh Like 👍"
              @click="handleSendLike"
            >
              👍
            </button>

            <!-- Khi CÓ chữ: Nút Gửi màu xanh -->
            <v-btn
              v-else
              icon="mdi-send"
              color="primary"
              variant="flat"
              size="small"
              density="comfortable"
              :loading="sending || sendingFile"
              title="Gửi tin nhắn (Enter)"
              @click="handleSend"
            />
          </div>
        </div>
      </div>
      <div v-else class="pa-3 text-left text-sm-center d-flex flex-wrap align-center justify-center" style="gap: 10px; background: rgba(var(--v-theme-primary), 0.05); border-top: 1px solid rgba(var(--v-theme-primary), 0.15);">
        <v-icon icon="mdi-shield-lock-outline" size="22" color="primary" />
        <div class="text-body-2 font-weight-medium" style="color: rgb(var(--v-theme-primary));">
          Hội thoại 1-1 do Sales phụ trách (Kế toán chỉ xem tra cứu). Kế toán được phép chat trong <strong>Nhóm chat (Group)</strong> hoặc khi được <strong>phân công xử lý</strong>.
        </div>
      </div>
    </template>

    <!-- Image preview dialog with Zoom, Pan, Open & Download toolbar -->
    <v-dialog v-model="showImagePreview" max-width="1100" content-class="elevation-0" scrollable>
      <div class="position-relative d-flex flex-column align-center justify-center pa-2" style="background: rgba(15, 23, 42, 0.92); border-radius: 16px; backdrop-filter: blur(12px); max-height: 92vh; overflow: hidden; width: 100%;">
        <!-- Top Action Bar -->
        <div class="d-flex flex-wrap align-center justify-space-between w-100 px-2 px-sm-4 py-2" style="gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.12); z-index: 10;">
          <div class="d-flex align-center text-white" style="gap: 8px;">
            <v-icon size="20" color="white">mdi-image-outline</v-icon>
            <span class="text-subtitle-2 font-weight-medium">Xem hình ảnh chi tiết</span>
            <span class="text-caption text-grey-lighten-1 ml-2">({{ Math.round(previewImageZoom * 100) }}%)</span>
          </div>

          <div class="d-flex align-center" style="gap: 6px;">
            <v-btn icon="mdi-magnify-minus-outline" size="small" variant="text" color="white" title="Thu nhỏ" @click.stop="previewImageZoom = Math.max(0.4, Number((previewImageZoom - 0.25).toFixed(2)))" />
            <v-btn icon="mdi-restore" size="small" variant="text" color="white" title="Đặt lại kích thước" @click.stop="previewImageZoom = 1" />
            <v-btn icon="mdi-magnify-plus-outline" size="small" variant="text" color="white" title="Phóng to" @click.stop="previewImageZoom = Math.min(3, Number((previewImageZoom + 0.25).toFixed(2)))" />
            <v-divider vertical class="mx-1" style="border-color: rgba(255,255,255,0.2);" />
            <v-btn icon="mdi-open-in-new" size="small" variant="text" color="white" title="Mở ảnh trong tab mới" @click.stop="openPreviewInNewTab" />
            <v-btn icon="mdi-download" size="small" variant="text" color="white" title="Tải ảnh về máy" @click.stop="downloadPreviewImage" />
            <v-btn icon="mdi-close" size="small" variant="text" color="white" title="Đóng (Esc)" @click="showImagePreview = false" />
          </div>
        </div>

        <!-- Center Image Stage -->
        <div class="d-flex align-center justify-center w-100 pa-4" style="max-height: 75vh; overflow: auto; cursor: default;" @click.self="showImagePreview = false">
          <img
            :src="previewImageUrl"
            alt="Preview"
            :style="{
              transform: `scale(${previewImageZoom})`,
              transition: 'transform 0.15s ease',
              maxWidth: previewImageZoom > 1 ? 'none' : '100%',
              maxHeight: previewImageZoom > 1 ? 'none' : '72vh',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'block'
            }"
            @dblclick="previewImageZoom = previewImageZoom > 1 ? 1 : 1.75"
            title="Nhấp đúp để phóng to / thu nhỏ"
          />
        </div>

        <!-- Caption & Footer -->
        <div v-if="previewImageCaption" class="mt-1 px-4 py-2 mx-auto text-body-2 font-weight-medium rounded-lg text-white text-center" style="background: rgba(0,0,0,0.6); max-width: min(800px, 100%); backdrop-filter: blur(8px); white-space: pre-wrap; word-break: break-word;">
          {{ previewImageCaption }}
        </div>
        <div class="text-caption mt-1 pb-1" style="color: #94a3b8; font-size: 0.75rem;">
          Dùng phím lăn chuột hoặc nút + / - để phóng to • Nhấp đúp chuột để zoom nhanh
        </div>
      </div>
    </v-dialog>

    <!-- Dialog: Xem trước khi gửi (Image 1 - Bottom Drop Zone) -->
    <v-dialog v-model="previewSendDialog.show" max-width="540" persistent>
      <v-card class="rounded-xl overflow-hidden" elevation="16">
        <div class="pa-4 d-flex align-center justify-space-between border-b dialog-header-bg">
          <div class="d-flex align-center" style="gap: 8px;">
            <v-icon color="primary" size="20">mdi-eye-check-outline</v-icon>
            <span class="text-subtitle-1 font-weight-bold">Xem trước khi gửi</span>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="closePreviewSendDialog" />
        </div>

        <v-card-text class="pa-4">
          <!-- Image preview -->
          <div v-if="previewSendDialog.isImage" class="text-center mb-3">
            <img
              :src="previewSendDialog.previewUrl"
              alt="Preview"
              class="rounded-lg border"
              style="max-width: 100%; max-height: 280px; object-fit: contain; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"
            />
            <div class="text-caption mt-1.5 text-medium-emphasis">
              {{ previewSendDialog.file?.name }} ({{ formatBytes(previewSendDialog.file?.size || 0) }})
            </div>
          </div>

          <!-- Non-image file preview -->
          <div v-else class="d-flex align-center pa-3 rounded-lg border mb-3" style="background: rgba(var(--v-theme-surface-variant), 0.3);">
            <v-avatar size="44" color="info" variant="tonal" rounded="lg" class="mr-3">
              <v-icon size="24" color="info">mdi-file-document-outline</v-icon>
            </v-avatar>
            <div class="flex-grow-1 text-truncate">
              <div class="text-body-2 font-weight-bold text-truncate">{{ previewSendDialog.file?.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ formatBytes(previewSendDialog.file?.size || 0) }}</div>
            </div>
          </div>

          <!-- Lời nhắn kèm file / ảnh -->
          <v-textarea
            v-model="previewSendDialog.caption"
            placeholder="Thêm lời nhắn / ghi chú kèm theo (tùy chọn)..."
            rows="2"
            auto-grow
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            autofocus
            @keydown.enter.exact.prevent="submitPreviewSend"
          />
        </v-card-text>

        <v-card-actions class="pa-3 px-4 border-t d-flex justify-end" style="gap: 8px;">
          <v-btn variant="text" class="rounded-lg text-none px-4" @click="closePreviewSendDialog">
            Hủy
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="rounded-lg text-none px-6 font-weight-bold"
            prepend-icon="mdi-send"
            :loading="sendingFile"
            @click="submitPreviewSend"
          >
            Gửi ngay
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Media Picker Modal -->
    <ChatMediaPickerModal
      v-if="conversation"
      v-model="showMediaPicker"
      :conversation-id="conversation.id"
      @sent="onMediaSent"
    />

    <!-- Forward Message Modal -->
    <ForwardMessageModal
      v-model="showForwardModal"
      :message="forwardModalMessage"
      :messages="forwardModalMessages"
      @forward-success="onForwardSuccess"
    />

    <!-- Send Bank Card Modal -->
    <SendBankCardModal
      v-if="conversation"
      v-model="showBankCardModal"
      :conversation-id="conversation.id"
      @sent="onRichMessageSent"
    />

    <!-- Send Contact Card Modal -->
    <SendContactCardModal
      v-if="conversation"
      v-model="showContactCardModal"
      :conversation-id="conversation.id"
      @sent="onRichMessageSent"
    />

    <!-- Create Native Zalo Reminder Modal -->
    <CreateZaloReminderModal
      v-if="conversation"
      v-model="showZaloReminderModal"
      :conversation-id="conversation.id"
      @sent="onRichMessageSent"
    />

    <!-- Create Native Zalo Poll Modal (Giai đoạn 3) -->
    <CreatePollModal
      v-if="conversation && conversation.threadType === 'group'"
      v-model="showPollModal"
      :conversation-id="conversation.id"
      @created="onPollCreated"
    />

    <!-- Phone Call Modal (Gọi điện thoại cho khách hàng) -->
    <v-dialog v-model="showCallDialog" max-width="440">
      <v-card rounded="xl" elevation="16" class="pa-0 call-dialog-card overflow-hidden">
        <!-- Top header gradient -->
        <div class="pa-5 text-white position-relative call-dialog-header" style="background: linear-gradient(135deg, #0e5c38 0%, #15804e 55%, #1eb56c 100%);">
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="d-flex align-center" style="gap: 8px;">
              <v-icon color="white" size="22">mdi-phone-in-talk</v-icon>
              <span class="text-subtitle-1 font-weight-bold">Gọi điện thoại</span>
            </div>
            <v-btn icon="mdi-close" variant="text" size="small" color="white" @click="showCallDialog = false" />
          </div>

          <div class="d-flex align-center mt-2" style="gap: 12px;">
            <v-avatar size="54" class="elevation-3 flex-shrink-0" style="border: 2px solid rgba(255, 255, 255, 0.85); background: #167a4c;">
              <v-img v-if="conversation?.contact?.avatarUrl" :src="conversation.contact.avatarUrl" cover referrerpolicy="no-referrer" />
              <span v-else class="text-h6 font-weight-bold text-white">{{ (conversation?.contact?.fullName || 'K')[0] }}</span>
            </v-avatar>
            <div class="overflow-hidden">
              <div class="text-subtitle-1 font-weight-bold text-truncate text-white">
                {{ conversation?.contact?.fullName || 'Khách hàng' }}
              </div>
              <div class="text-caption" style="color: rgba(255, 255, 255, 0.85);">
                {{ conversation?.zaloAccount?.displayName ? `Zalo: ${conversation.zaloAccount.displayName}` : 'Khách hàng Zalo' }}
              </div>
            </div>
          </div>
        </div>

        <v-card-text class="pa-5 d-flex flex-column" style="gap: 16px;">
          <!-- Khi ĐÃ CÓ số điện thoại -->
          <div v-if="effectiveContactPhone" class="d-flex flex-column align-center text-center pa-4 rounded-xl" style="background: rgba(var(--v-theme-surface-variant), 0.35); border: 1px solid rgba(var(--v-border-color), 0.12);">
            <div class="text-caption text-medium-emphasis mb-1">Số điện thoại khách hàng</div>
            <div class="text-h5 font-weight-bold tracking-wider mb-2" style="color: #15804e; letter-spacing: 1px;">
              {{ effectiveContactPhone }}
            </div>
            <div class="d-flex align-center" style="gap: 8px;">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                rounded="pill"
                prepend-icon="mdi-content-copy"
                @click="copyToClipboard(effectiveContactPhone, 'Số điện thoại')"
              >
                Sao chép số
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                rounded="pill"
                color="medium-emphasis"
                prepend-icon="mdi-pencil-outline"
                @click="isEditingCallPhone = !isEditingCallPhone"
              >
                {{ isEditingCallPhone ? 'Đóng sửa' : 'Đổi số' }}
              </v-btn>
            </div>
          </div>

          <!-- Form chỉnh sửa/nhập số điện thoại nếu cần đổi hoặc chưa có -->
          <div v-if="!effectiveContactPhone || isEditingCallPhone" class="d-flex flex-column" style="gap: 10px;">
            <div class="text-caption font-weight-medium text-medium-emphasis">
              {{ effectiveContactPhone ? 'Nhập số điện thoại mới cho khách hàng:' : 'Khách hàng chưa có SĐT. Vui lòng nhập số để gọi:' }}
            </div>
            <v-text-field
              v-model="callPhoneInput"
              placeholder="Ví dụ: 0981155524"
              variant="outlined"
              density="compact"
              hide-details
              type="tel"
              prepend-inner-icon="mdi-phone"
              class="rounded-lg"
            />
          </div>

          <!-- Các nút hành động gọi điện -->
          <div class="d-flex flex-column" style="gap: 10px;">
            <!-- Nút gọi chính: Click to Call qua tel: -->
            <v-btn
              color="success"
              variant="flat"
              size="large"
              rounded="xl"
              prepend-icon="mdi-phone"
              class="font-weight-bold text-white elevation-2"
              style="height: 48px; background: linear-gradient(135deg, #15804e 0%, #1eb56c 100%) !important;"
              :loading="savingPhone"
              @click="(!effectiveContactPhone || isEditingCallPhone) ? handleSavePhoneAndCall() : handleMakePhoneCall(effectiveContactPhone)"
            >
              {{ (!effectiveContactPhone || isEditingCallPhone) ? 'Lưu & Gọi ngay' : 'Gọi ngay (Click-to-Call)' }}
            </v-btn>

            <!-- Nút mở chat / gọi qua Zalo -->
            <v-btn
              v-if="effectiveContactPhone || callPhoneInput"
              variant="outlined"
              color="primary"
              size="large"
              rounded="xl"
              prepend-icon="mdi-message-text-outline"
              class="font-weight-medium"
              style="height: 44px;"
              @click="handleOpenZaloCall(effectiveContactPhone || callPhoneInput)"
            >
              Mở trang liên hệ Zalo (zalo.me)
            </v-btn>
          </div>

          <!-- Ghi chú mẹo gọi điện -->
          <div class="pa-3 rounded-lg text-caption d-flex align-start" style="background: rgba(var(--v-theme-on-surface), 0.04); gap: 8px; line-height: 1.45;">
            <v-icon size="16" color="warning" class="flex-shrink-0 mt-0.5">mdi-information-outline</v-icon>
            <span class="text-medium-emphasis" style="font-size: 0.76rem;">
              Cuộc gọi Click-to-Call sẽ tự động mở ứng dụng gọi điện trên máy tính (FaceTime, Skype, Zoiper, Softphone tổng đài) hoặc chuyển tiếp cuộc gọi đến điện thoại của bạn.
            </span>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ── Modal Cập nhật Trạng thái & Lưu ý Khách hàng / Đơn hàng ── -->
    <v-dialog v-model="showNoteDialog" max-width="500">
      <v-card rounded="xl" elevation="16" class="customer-note-dialog">
        <!-- Dialog Header -->
        <div class="pa-4 d-flex align-center justify-space-between border-b dialog-header-bg">
          <div class="d-flex align-center" style="gap: 10px;">
            <v-avatar size="38" color="amber-lighten-4">
              <v-icon color="amber-darken-3" size="22">mdi-pin</v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold" style="line-height: 1.2;">Lưu ý & Trạng thái khách hàng</div>
              <div class="text-caption text-medium-emphasis">Ghim lưu ý quan trọng lên đầu cuộc trò chuyện</div>
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="showNoteDialog = false" />
        </div>

        <v-card-text class="pa-4">
          <!-- Khách hàng info bar -->
          <div class="d-flex align-center pa-2.5 rounded-lg mb-4" style="gap: 10px; background: rgba(var(--v-theme-surface-variant), 0.35);">
            <v-avatar size="32" color="grey-lighten-2">
              <v-img v-if="conversation?.contact?.avatarUrl" :src="conversation.contact.avatarUrl" referrerpolicy="no-referrer" />
              <v-icon v-else size="18">mdi-account</v-icon>
            </v-avatar>
            <div class="flex-grow-1 text-truncate">
              <div class="text-body-2 font-weight-bold text-truncate">{{ conversation?.contact?.fullName || 'Khách hàng' }}</div>
              <div class="text-caption text-medium-emphasis">{{ conversation?.contact?.phone || conversation?.zaloAccount?.displayName || 'Zalo Chat' }}</div>
            </div>
          </div>

          <!-- 1. Trạng thái làm việc với khách -->
          <div class="mb-4">
            <label class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1.5 d-block" style="letter-spacing: 0.5px;">
              Trạng thái khách hàng
            </label>
            <div class="d-flex flex-wrap" style="gap: 6px;">
              <v-chip
                v-for="st in CUSTOMER_STATUSES"
                :key="st.value"
                size="small"
                :color="st.color"
                :variant="noteForm.status === st.value ? 'flat' : 'outlined'"
                class="font-weight-medium cursor-pointer"
                @click="noteForm.status = st.value"
              >
                <v-icon start size="14">{{ st.icon }}</v-icon>
                {{ st.text }}
              </v-chip>
            </div>
          </div>

          <!-- 2. Ô nhập Lưu ý / Yêu cầu của khách / Đơn hàng -->
          <div class="mb-3">
            <div class="d-flex align-center justify-space-between mb-1.5">
              <label class="text-caption font-weight-bold text-uppercase text-medium-emphasis" style="letter-spacing: 0.5px;">
                Dòng Lưu ý / Yêu cầu ghim ở trên
              </label>
              <span class="text-caption text-medium-emphasis">{{ noteForm.pinnedNote.length }}/200</span>
            </div>
            <v-textarea
              v-model="noteForm.pinnedNote"
              placeholder="Ví dụ: Khách muốn giao sau 17h, cần xuất hóa đơn VAT, đã cọc 500k, gọi xác nhận trước khi giao..."
              variant="outlined"
              rows="3"
              max-rows="6"
              auto-grow
              density="comfortable"
              counter="200"
              maxlength="200"
              class="rounded-lg"
              hide-details="auto"
            />
          </div>

          <!-- 3. Gợi ý mẫu lưu ý nhanh -->
          <div>
            <div class="text-caption text-medium-emphasis mb-1">Gợi ý nhanh:</div>
            <div class="d-flex flex-wrap" style="gap: 6px;">
              <v-chip
                v-for="preset in NOTE_PRESETS"
                :key="preset"
                size="x-small"
                variant="tonal"
                class="cursor-pointer"
                @click="insertNotePreset(preset)"
              >
                + {{ preset }}
              </v-chip>
            </div>
          </div>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-divider />
        <v-card-actions class="pa-3 px-4 d-flex flex-wrap align-center justify-space-between" style="gap: 8px;">
          <v-btn
            v-if="currentPinnedNote"
            color="error"
            variant="text"
            size="small"
            prepend-icon="mdi-delete-outline"
            :loading="savingNote"
            @click="clearPinnedNote"
          >
            Gỡ lưu ý
          </v-btn>
          <div v-else></div>

          <div class="d-flex flex-wrap align-center ml-auto" style="gap: 8px;">
            <v-btn variant="text" size="small" @click="showNoteDialog = false">Hủy</v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              rounded="lg"
              prepend-icon="mdi-pin"
              class="px-4 font-weight-bold"
              :loading="savingNote"
              @click="saveCustomerNote"
            >
              Lưu & Ghim lên trên
            </v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Appointment Creation Modal (Tạo nhắc hẹn) -->
    <v-dialog v-model="showAppointmentDialog" max-width="480">
      <v-card rounded="xl" class="pa-0 appointment-dialog-card">
        <v-card-title class="pa-4 border-b d-flex align-center justify-space-between">
          <div class="d-flex align-center" style="gap: 8px;">
            <v-icon color="primary" size="22">mdi-calendar-clock</v-icon>
            <span class="text-subtitle-1 font-weight-bold">Tạo nhắc hẹn</span>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="showAppointmentDialog = false" />
        </v-card-title>

        <v-card-text class="pa-4 d-flex flex-column" style="gap: 16px;">
          <!-- Customer Info -->
          <div v-if="conversation?.contact" class="d-flex align-center pa-2.5 rounded-lg" style="background: rgba(var(--v-theme-surface-variant), 0.35); gap: 10px;">
            <v-avatar size="32" color="primary">
              <span class="text-caption font-weight-bold text-white">{{ (conversation.contact.fullName || 'K')[0] }}</span>
            </v-avatar>
            <div class="text-truncate">
              <div class="text-body-2 font-weight-bold">{{ conversation.contact.fullName || 'Khách hàng' }}</div>
              <div class="text-caption text-medium-emphasis">{{ effectiveContactPhone || 'Chưa có SĐT' }}</div>
            </div>
          </div>

          <!-- Notes / Content -->
          <v-textarea
            v-model="appointmentForm.notes"
            label="Nội dung nhắc hẹn"
            variant="outlined"
            density="compact"
            rows="2"
            max-rows="4"
            auto-grow
            hide-details
          />

          <div class="d-flex flex-wrap" style="gap: 12px;">
            <!-- Date -->
            <v-text-field
              v-model="appointmentForm.date"
              label="Ngày hẹn"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              style="flex: 1 1 140px; min-width: 140px;"
            />

            <!-- Time -->
            <v-text-field
              v-model="appointmentForm.time"
              label="Giờ hẹn"
              type="time"
              variant="outlined"
              density="compact"
              hide-details
              style="flex: 1 1 120px; min-width: 120px;"
            />
          </div>

          <!-- Type -->
          <v-select
            v-model="appointmentForm.type"
            label="Phân loại hẹn"
            :items="[
              { title: 'Tư vấn', value: 'tu_van' },
              { title: 'Khám mới', value: 'kham_moi' },
              { title: 'Tái khám', value: 'tai_kham' },
              { title: 'Nhắc hẹn khác', value: 'khac' }
            ]"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-card-text>

        <v-card-actions class="pa-3 px-4 border-t d-flex justify-end" style="gap: 8px;">
          <v-btn variant="text" rounded="lg" @click="showAppointmentDialog = false">Hủy</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            prepend-icon="mdi-check"
            :loading="savingAppointment"
            @click="saveAppointment"
          >
            Lưu nhắc hẹn
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Sync snackbar -->
    <v-snackbar v-model="syncSnack.show" :color="syncSnack.color" timeout="3000">{{ syncSnack.text }}</v-snackbar>

    <!-- Quản trị nhóm Zalo Drawer (Giai đoạn 2) -->
    <GroupManagementDrawer
      v-if="conversation && conversation.threadType === 'group'"
      v-model="showGroupDrawer"
      :conversation="conversation"
      @updated="onGroupUpdated"
    />

    <!-- Dialog Tạo nhãn mới (Image 4) -->
    <v-dialog v-model="createTagDialog.open" max-width="380">
      <v-card class="rounded-xl border elevation-10 pa-4" style="background: rgb(var(--v-theme-surface)) !important;">
        <v-card-title class="pa-0 mb-3 text-subtitle-1 font-weight-bold d-flex align-center">
          <v-icon start color="primary" class="mr-2">mdi-tag-plus-outline</v-icon>
          Tạo nhãn phân loại mới
        </v-card-title>
        <v-text-field
          v-model="createTagDialog.tagName"
          label="Tên nhãn"
          placeholder="Ví dụ: Đại lý, Cộng tác viên, Dự án..."
          variant="outlined"
          density="compact"
          autofocus
          hide-details
          class="mb-3"
          @keyup.enter="confirmCreateTag"
        />
        <v-card-actions class="pa-0 d-flex justify-end" style="gap: 8px;">
          <v-btn variant="text" size="small" class="rounded-lg text-none" @click="createTagDialog.open = false">Hủy</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            class="rounded-lg text-none font-weight-bold px-4"
            :disabled="!createTagDialog.tagName.trim()"
            @click="confirmCreateTag"
          >
            Lưu nhãn
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { integrationStorage } from '@/modules/zalocrm/integration';
import zaloLogoUrl from '@/modules/zalocrm/assets/logo-zalo.webp';

import { ref, watch, nextTick, computed, onMounted, onUnmounted, reactive } from 'vue';
import { useTheme } from 'vuetify';
import type { Conversation, Message } from '@/modules/zalocrm/composables/use-chat';
import { api } from '@/modules/zalocrm/api/index';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';
import ChatMediaPickerModal from './ChatMediaPickerModal.vue';
import ChatDropzone from './ChatDropzone.vue';
import QuickRepliesMenu from './QuickRepliesMenu.vue';
import ForwardMessageModal from './ForwardMessageModal.vue';
import SendBankCardModal from './SendBankCardModal.vue';
import SendContactCardModal from './SendContactCardModal.vue';
import CreateZaloReminderModal from './CreateZaloReminderModal.vue';
import GroupManagementDrawer from './GroupManagementDrawer.vue';
import CreatePollModal from './CreatePollModal.vue';
import { zaloExtendedApi } from '@/modules/zalocrm/api/zalo-extended';
import { CONVERSATION_CATEGORIES } from '@/modules/zalocrm/constants/conversation-categories';
import { CUSTOMER_STATUS_LIST, normalizeCustomerStatus } from '@/modules/zalocrm/constants/customer-statuses';
import {
  getVoiceInfo,
  getStickerUrl,
  getVideoInfo,
  getImageUrl,
  getImageFullUrl,
  getImageCaption,
  getImageFallbackUrl,
  getFileInfo,
  isEmptyMediaJson,
  isValidMediaUrl,
  sanitizeMediaCaption,
  type FileCardInfo,
} from '@/modules/zalocrm/utils/message-media';

const reactionList = [
  { name: 'like', emoji: '👍', title: 'Thích', icon: '👍' },
  { name: 'heart', emoji: '❤️', title: 'Yêu thích', icon: '❤️' },
  { name: 'haha', emoji: '😂', title: 'Haha', icon: '😂' },
  { name: 'wow', emoji: '😮', title: 'Wow', icon: '😮' },
  { name: 'sad', emoji: '😢', title: 'Buồn', icon: '😢' },
  { name: 'angry', emoji: '😡', title: 'Phẫn nộ', icon: '😡' },
];

const commonEmojis = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😊', '😍', '🥰',
  '😘', '👍', '❤️', '🔥', '🎉', '👏', '🤝', '🙏', '💯', '⭐',
  '😎', '🥳', '🤔', '😭', '😡', '🤐', '👋', '💪', '💰', '✨'
];

const props = defineProps<{
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  showContactPanel?: boolean;
  isMobile?: boolean;
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
}>();

const authStore = useAuthStore();

const canChat = computed(() => {
  if (authStore.user?.role === 'accountant') {
    if (!props.conversation) return false;
    // 1. Nhóm chat Zalo (Group): Kế toán được phép chat để trao đổi, xác nhận tiền, gửi hóa đơn
    if (props.conversation.threadType === 'group') return true;

    // 2. Hội thoại / Khách hàng được phân công cho Kế toán hoặc có ghi chú/nhu cầu bàn giao
    const contact = props.conversation.contact;
    if (contact?.assignedUserId === authStore.user?.id) return true;
    if (contact?.notes?.includes('[Chuyển cho Kế toán]')) return true;
    const meta = (contact?.metadata || {}) as any;
    if (meta?.handedOffToAccountant || meta?.customerNeed) return true;

    // 3. Hội thoại 1-1 thông thường do Sales phụ trách: Kế toán chỉ xem tra cứu
    return false;
  }
  return true;
});

const chatRecipientName = computed(() => {
  if (!props.conversation) return 'My Documents';
  if (props.conversation.threadType === 'group') {
    return props.conversation.contact?.fullName || 'nhóm';
  }
  return props.conversation.contact?.fullName || 'khách hàng';
});

function insertEmoji(emoji: string) {
  inputText.value = (inputText.value || '') + emoji;
}

function handleSendLike() {
  emit('send', '👍', replyingTo.value?.id);
  replyingTo.value = null;
}

function markImportantMessage() {
  if (!inputText.value.startsWith('[Quan trọng] ')) {
    inputText.value = '[Quan trọng] ' + inputText.value;
  }
}

function markUrgentMessage() {
  if (!inputText.value.startsWith('[Khẩn cấp] ')) {
    inputText.value = '[Khẩn cấp] ' + inputText.value;
  }
}

function promptScreenshotTip() {
  syncSnack.value = {
    show: true,
    text: 'Mẹo: Bạn có thể nhấn phím chụp màn hình trên máy tính và nhấn Ctrl+V / Cmd+V để dán trực tiếp ảnh vào ô chat!',
    color: 'info',
  };
}

function toggleTextFormatting() {
  if (inputText.value.trim()) {
    inputText.value = `**${inputText.value}**`;
  } else {
    inputText.value = '**Nội dung in đậm**';
  }
}

const emit = defineEmits<{
  send: [content: string, quoteMessageId?: string];
  'send-file': [file: File, caption?: string];
  'recall-message': [messageId: string];
  'delete-message-for-me': [messageId: string];
  'toggle-mute': [convId: string, isMuted: boolean];
  'toggle-contact-panel': [];
  'group-updated': [];
  'contact-updated': [];
  'load-older': [];
  back: [];
}>();

const quickTagMenuOpen = ref(false);

const localContactTags = ref<string[]>([]);

function syncContactTagsFromProp() {
  const raw = props.conversation?.contact?.tags;
  if (Array.isArray(raw)) {
    localContactTags.value = [...raw];
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      localContactTags.value = Array.isArray(parsed) ? parsed : (raw ? [raw] : []);
    } catch {
      localContactTags.value = raw ? [raw] : [];
    }
  } else {
    localContactTags.value = [];
  }
}

watch(
  () => [props.conversation?.id, props.conversation?.contact?.id, props.conversation?.contact?.tags],
  () => {
    syncContactTagsFromProp();
  },
  { immediate: true, deep: true }
);

const currentContactTags = computed<string[]>(() => {
  return localContactTags.value;
});

const contactRoleTag = computed<'Khách hàng' | 'Nhà cung cấp' | 'Nội bộ công ty' | null>(() => {
  const tags = localContactTags.value || [];
  if (tags.includes('Khách hàng') || effectiveIsCustomer.value) return 'Khách hàng';
  if (tags.includes('Nhà cung cấp') || tags.includes('NCC')) return 'Nhà cung cấp';
  if (tags.includes('Nội bộ công ty') || tags.includes('Nội bộ') || tags.includes('Noi bo')) return 'Nội bộ công ty';
  return null;
});

const createTagDialog = reactive({
  open: false,
  tagName: '',
});

function openCreateTagDialog() {
  createTagDialog.open = true;
  createTagDialog.tagName = '';
}

async function confirmCreateTag() {
  const name = createTagDialog.tagName.trim();
  if (!name) return;
  await toggleContactTag(name);
  createTagDialog.open = false;
  createTagDialog.tagName = '';
}

let saveTagsTimeout: any = null;
async function toggleContactTag(tagTitle: string) {
  const contact = props.conversation?.contact;
  if (!contact || !contact.id) return;

  const current = [...localContactTags.value];
  const idx = current.indexOf(tagTitle);
  if (idx !== -1) {
    current.splice(idx, 1);
  } else {
    current.push(tagTitle);
  }

  // Instant local update so selecting multiple items is smooth and immediate
  localContactTags.value = current;

  clearTimeout(saveTagsTimeout);
  saveTagsTimeout = setTimeout(async () => {
    try {
      await api.put(`/contacts/${contact.id}/tags`, { tags: localContactTags.value });
      emit('contact-updated');
    } catch (err) {
      console.error('Failed to update tags:', err);
    }
  }, 350);
}

const showGroupDrawer = ref(false);
const showPollModal = ref(false);

function onGroupUpdated() {
  emit('group-updated');
}

function onPollCreated() {
  syncSnack.value = { show: true, text: 'Đã tạo cuộc bình chọn Zalo thành công!', color: 'success' };
}

const replyingTo = ref<Message | null>(null);
const showForwardModal = ref(false);
const forwardModalMessage = ref<Message | null>(null);
const forwardModalMessages = ref<Message[]>([]);

// Multi-select state
const isMultiSelectMode = ref(false);
const selectedMsgIds = ref<Set<string>>(new Set());

function enterMultiSelectMode(msg?: Message) {
  isMultiSelectMode.value = true;
  selectedMsgIds.value = new Set(msg ? [msg.id] : []);
}

function exitMultiSelect() {
  isMultiSelectMode.value = false;
  selectedMsgIds.value = new Set();
  forwardModalMessages.value = [];
}

function toggleMsgSelect(msg: Message) {
  if (!isMultiSelectMode.value) return;
  const next = new Set(selectedMsgIds.value);
  if (next.has(msg.id)) {
    next.delete(msg.id);
  } else {
    next.add(msg.id);
  }
  selectedMsgIds.value = next;
}

function openForwardSelectedModal() {
  forwardModalMessage.value = null;
  forwardModalMessages.value = props.messages.filter(m => selectedMsgIds.value.has(m.id));
  showForwardModal.value = true;
}

async function deleteSelectedMessagesForMe() {
  if (!props.conversation?.id || selectedMsgIds.value.size === 0) return;
  const count = selectedMsgIds.value.size;
  const idsToDelete = Array.from(selectedMsgIds.value);
  exitMultiSelect();
  try {
    for (const id of idsToDelete) {
      await api.post(`/conversations/${props.conversation.id}/messages/${id}/delete-for-me`);
      emit('delete-message-for-me', id);
    }
    syncSnack.value = { show: true, text: `Đã xóa ${count} tin nhắn chỉ ở phía bạn!`, color: 'success' };
  } catch (err: any) {
    console.error('Failed to delete selected messages for me:', err);
    syncSnack.value = { show: true, text: 'Xóa tin nhắn thất bại', color: 'error' };
  }
}

// Recall (Thu hồi) & Delete for me only (Xóa chỉ ở phía tôi)
async function handleRecall(msg: Message) {
  if (!props.conversation?.id) return;

  if (msg.isDeleted) {
    syncSnack.value = { show: true, text: 'Tin nhắn này đã được thu hồi trước đó rồi.', color: 'info' };
    return;
  }
  if (msg.senderType !== 'self') {
    syncSnack.value = { show: true, text: 'Chỉ có thể thu hồi tin nhắn do chính bạn gửi đi.', color: 'warning' };
    return;
  }
  if (msg.sentAt) {
    const msgTime = new Date(msg.sentAt).getTime();
    const hoursAgo = (Date.now() - msgTime) / (1000 * 60 * 60);
    if (hoursAgo > 24) {
      syncSnack.value = {
        show: true,
        text: 'Zalo chỉ cho phép thu hồi tin nhắn trong vòng 24 giờ kể từ khi gửi.',
        color: 'warning'
      };
      return;
    }
  }

  try {
    const res = await api.post(`/conversations/${props.conversation.id}/messages/${msg.id}/undo`);
    if (res.data?.success && res.data?.zaloSynced !== false) {
      emit('recall-message', msg.id);
      syncSnack.value = { show: true, text: 'Đã thu hồi tin nhắn cả 2 phía thành công!', color: 'success' };
    } else if (res.data?.zaloSynced === false) {
      const rawError = res.data?.error || res.data?.zaloWarning || '';
      const cleanMsg = rawError.includes('Lỗi không xác định') || rawError.includes('110')
        ? 'Zalo từ chối thu hồi (tin nhắn có thể đã quá 24h hoặc đã được thu hồi trước đó trên Zalo).'
        : (rawError || 'Zalo từ chối thu hồi tin nhắn (tin nhắn có thể đã quá thời hạn cho phép).');
      syncSnack.value = {
        show: true,
        text: cleanMsg,
        color: 'warning'
      };
    } else {
      const rawError = res.data?.error || '';
      const cleanMsg = rawError.includes('Lỗi không xác định') || rawError.includes('110')
        ? 'Zalo từ chối thu hồi (tin nhắn có thể đã quá 24h hoặc đã được thu hồi trước đó trên Zalo).'
        : (rawError || 'Thu hồi tin nhắn thất bại');
      syncSnack.value = { show: true, text: cleanMsg, color: 'error' };
    }
  } catch (err: any) {
    console.error('Failed to recall message:', err);
    const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || '';
    const cleanMsg = errMsg.includes('Lỗi không xác định') || errMsg.includes('110')
      ? 'Zalo từ chối thu hồi (tin nhắn có thể đã quá 24h hoặc đã được thu hồi trước đó trên Zalo).'
      : (errMsg || 'Thu hồi tin nhắn thất bại');
    syncSnack.value = { show: true, text: cleanMsg, color: 'error' };
  }
}

async function handleDeleteOnlyMe(msg: Message) {
  if (!props.conversation?.id) return;
  try {
    await api.post(`/conversations/${props.conversation.id}/messages/${msg.id}/delete-for-me`);
    emit('delete-message-for-me', msg.id);
    syncSnack.value = { show: true, text: 'Đã xóa tin nhắn chỉ ở phía tôi!', color: 'success' };
  } catch (err: any) {
    console.error('Failed to delete message for me:', err);
    syncSnack.value = { show: true, text: err.response?.data?.error || 'Xóa tin nhắn thất bại', color: 'error' };
  }
}

// Appointment / Reminder modal state & handlers
const showAppointmentDialog = ref(false);
const savingAppointment = ref(false);
const appointmentForm = ref({
  notes: '',
  date: '',
  time: '09:00',
  type: 'tu_van',
});

function openAppointmentDialog(msg: Message) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');

  const snippet = msg.content ? parseDisplayContent(msg.content) : '';
  appointmentForm.value = {
    notes: snippet.length > 200 ? snippet.slice(0, 200) + '...' : snippet,
    date: `${yyyy}-${mm}-${dd}`,
    time: '09:00',
    type: 'tu_van',
  };
  showAppointmentDialog.value = true;
}

async function saveAppointment() {
  if (!props.conversation?.contact?.id) {
    syncSnack.value = { show: true, text: 'Hội thoại này chưa liên kết hồ sơ khách hàng', color: 'warning' };
    showAppointmentDialog.value = false;
    return;
  }
  if (!appointmentForm.value.date) {
    syncSnack.value = { show: true, text: 'Vui lòng chọn ngày hẹn', color: 'warning' };
    return;
  }
  savingAppointment.value = true;
  try {
    const dt = new Date(`${appointmentForm.value.date}T${appointmentForm.value.time || '09:00'}:00`);
    await api.post('/appointments', {
      contactId: props.conversation.contact.id,
      appointmentDate: dt.toISOString(),
      appointmentTime: appointmentForm.value.time || '09:00',
      type: appointmentForm.value.type,
      notes: appointmentForm.value.notes?.trim() || undefined,
    });
    syncSnack.value = { show: true, text: 'Đã tạo nhắc hẹn thành công!', color: 'success' };
    showAppointmentDialog.value = false;
  } catch (err: any) {
    console.error('Failed to save appointment:', err);
    syncSnack.value = { show: true, text: err.response?.data?.error || 'Tạo nhắc hẹn thất bại', color: 'error' };
  } finally {
    savingAppointment.value = false;
  }
}

// Message Reactions state (msg.id -> emoji)
const messageReactions = ref<Record<string, string>>({});

function loadReactionsFromStorage() {
  try {
    const saved = integrationStorage.getItem('crm-msg-reactions');
    if (saved) {
      messageReactions.value = JSON.parse(saved);
    }
  } catch {}
}

function saveReactionsToStorage() {
  try {
    integrationStorage.setItem('crm-msg-reactions', JSON.stringify(messageReactions.value));
  } catch {}
}

function getMessageReaction(msg: Message): string | null {
  if (Object.prototype.hasOwnProperty.call(messageReactions.value, msg.id)) {
    return messageReactions.value[msg.id] || null;
  }
  if (msg.zaloMsgId && Object.prototype.hasOwnProperty.call(messageReactions.value, msg.zaloMsgId)) {
    return messageReactions.value[msg.zaloMsgId] || null;
  }
  if (msg.attachments) {
    let att = msg.attachments;
    if (typeof att === 'string') {
      try { att = JSON.parse(att); } catch {}
    }
    if (Array.isArray(att)) {
      const r = att.find((x: any) => x && (x.type === 'reaction' || x.reaction));
      if (r) return r.reaction || r.emoji || null;
    } else if (att && typeof att === 'object' && att.reaction) {
      return att.reaction;
    }
  }
  return null;
}

async function applyMsgReaction(msg: Message, reaction: string) {
  const current = getMessageReaction(msg);
  const targetReaction = (current === reaction || reaction === '') ? '' : reaction;

  // Update reactive reaction map (keep empty-string sentinel on removal without mutating props)
  messageReactions.value[msg.id] = targetReaction;
  if (msg.zaloMsgId) messageReactions.value[msg.zaloMsgId] = targetReaction;
  saveReactionsToStorage();

  // Sync to backend (Zalo or WhatsApp)
  if (props.conversation) {
    const targetMsgId = msg.zaloMsgId || msg.id;
    try {
      await zaloExtendedApi.addReaction(props.conversation.id, {
        zaloMsgId: targetMsgId,
        reaction: targetReaction,
      });
      syncSnack.value = {
        show: true,
        text: targetReaction ? `Đã thả cảm xúc ${targetReaction} vào tin nhắn!` : 'Đã gỡ cảm xúc khỏi tin nhắn',
        color: 'success',
      };
    } catch (err: any) {
      console.warn('Failed to sync reaction with Zalo/WhatsApp:', err);
    }
  }
}

function onCornerBadgeClick(msg: Message) {
  const current = getMessageReaction(msg);
  if (current) {
    applyMsgReaction(msg, current);
  } else {
    applyMsgReaction(msg, '❤️');
  }
}

async function sendMsgReaction(msg: Message, reaction: string) {
  await applyMsgReaction(msg, reaction);
}
void sendMsgReaction;

function handleIncomingReactionEvent(e: any) {
  const data = e.detail;
  if (!data) return;
  const { messageId, zaloMsgId, reaction } = data;
  if (messageId) messageReactions.value[messageId] = reaction || '';
  if (zaloMsgId) messageReactions.value[zaloMsgId] = reaction || '';
  saveReactionsToStorage();
}

onMounted(() => {
  loadReactionsFromStorage();
  window.addEventListener('crm:message-reaction', handleIncomingReactionEvent);
});

onUnmounted(() => {
  window.removeEventListener('crm:message-reaction', handleIncomingReactionEvent);
});

function startReply(msg: Message) {
  replyingTo.value = msg;
}

function cancelReply() {
  replyingTo.value = null;
}

function startForward(msg: Message) {
  forwardModalMessage.value = msg;
  forwardModalMessages.value = [];
  showForwardModal.value = true;
}

function onForwardSuccess(count: number) {
  syncSnack.value = {
    show: true,
    text: `Đã chuyển tiếp tin nhắn tới ${count} cuộc trò chuyện thành công!`,
    color: 'success',
  };
  if (isMultiSelectMode.value) {
    exitMultiSelect();
  }
}

function formatFullMessageTime(d: string) {
  try {
    return new Date(d).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function copyMessageContent(msg: Message) {
  if (!msg.content) return;
  const text = parseDisplayContent(msg.content);
  navigator.clipboard.writeText(text).then(() => {
    syncSnack.value = { show: true, text: 'Đã sao chép nội dung tin nhắn!', color: 'success' };
  }).catch(() => {
    syncSnack.value = { show: true, text: 'Không thể sao chép', color: 'error' };
  });
}

function pinMessage(_msg: Message) {
  syncSnack.value = { show: true, text: 'Đã ghim tin nhắn này!', color: 'success' };
}

function starMessage(_msg: Message) {
  syncSnack.value = { show: true, text: 'Đã đánh dấu tin nhắn này!', color: 'success' };
}

function showMessageDetails(msg: Message) {
  const time = formatFullMessageTime(msg.sentAt);
  const sender = msg.senderType === 'self' ? 'Bạn' : (msg.senderName || 'Khách hàng');
  syncSnack.value = {
    show: true,
    text: `Người gửi: ${sender} • Lúc: ${time}${msg.zaloMsgId ? ` • Mã: ${msg.zaloMsgId}` : ''}`,
    color: 'info',
  };
}

function getQuoteInfo(msg: Message): { ownerId?: string; fromD?: string; msg?: string; attach?: any; globalMsgId?: string; quoteMessageId?: string } | null {
  if (!msg.attachments) return null;
  let attList = msg.attachments;
  if (typeof attList === 'string') {
    try { attList = JSON.parse(attList); } catch { return null; }
  }
  if (!Array.isArray(attList)) return null;
  const quote = attList.find((a: any) => a.type === 'quote');
  return quote || null;
}

function getForwardInfo(msg: Message): { originalSender?: string; sourceConversationId?: string } | null {
  if (!msg.attachments) return null;
  let attList = msg.attachments;
  if (typeof attList === 'string') {
    try { attList = JSON.parse(attList); } catch { return null; }
  }
  if (!Array.isArray(attList)) return null;
  const fwd = attList.find((a: any) => a.type === 'forwarded');
  return fwd || null;
}

function getQuoteSnippet(quote: any): string {
  if (!quote) return '';
  if (quote.msg && quote.msg.trim()) {
    return quote.msg;
  }
  if (quote.cliMsgType === 32 || quote.attach) {
    return '[Hình ảnh]';
  }
  return '[Tin nhắn]';
}

function getMessageSnippet(msg: Message): string {
  if (getImageUrl(msg)) {
    const caption = getImageCaption(msg);
    return caption ? `[Hình ảnh]: ${caption}` : '[Hình ảnh]';
  }
  const file = getFileInfo(msg);
  if (file) {
    return `[Tệp]: ${file.name}`;
  }
  return msg.content || '';
}

function scrollToQuotedMessage(quote: any) {
  if (!quote) return;
  const quoteTarget = props.messages.find(m => 
    (quote.quoteMessageId && m.id === quote.quoteMessageId) ||
    (quote.globalMsgId && (m.zaloMsgId === quote.globalMsgId || m.id === quote.globalMsgId))
  );
  if (quoteTarget) {
    const el = document.getElementById(`msg-${quoteTarget.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight-pulse');
      setTimeout(() => {
        el.classList.remove('message-highlight-pulse');
      }, 2000);
    }
  }
}

const retriedPrimarySrcById = ref<Record<string, string>>({});
const failedSrcById = ref<Record<string, string>>({});

function getRenderImageUrl(msg: Message): string | null {
  const primary = getImageUrl(msg);
  const fallback = getImageFallbackUrl(msg);
  if (primary && retriedPrimarySrcById.value[msg.id] === primary && fallback && fallback !== primary) {
    return fallback;
  }
  return primary;
}

function isChatImageFailed(msg: Message): boolean {
  const url = getRenderImageUrl(msg);
  return !url || failedSrcById.value[msg.id] === url;
}

function onChatImageError(msg: Message) {
  const primary = getImageUrl(msg);
  const fallback = getImageFallbackUrl(msg);
  const current = getRenderImageUrl(msg);
  if (primary && current === primary && fallback && fallback !== primary && retriedPrimarySrcById.value[msg.id] !== primary) {
    retriedPrimarySrcById.value = { ...retriedPrimarySrcById.value, [msg.id]: primary };
    return;
  }
  if (current) {
    failedSrcById.value = { ...failedSrcById.value, [msg.id]: current };
  }
}

watch(() => props.conversation?.id, () => {
  replyingTo.value = null;
  retriedPrimarySrcById.value = {};
  failedSrcById.value = {};
  exitMultiSelect();
});

const inputText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const previewImageUrl = ref('');
const previewImageCaption = ref('');
const previewImageZoom = ref(1);
const showImagePreview = computed({
  get: () => !!previewImageUrl.value,
  set: (v) => {
    if (!v) {
      previewImageUrl.value = '';
      previewImageCaption.value = '';
      previewImageZoom.value = 1;
    }
  }
});

function openPreviewInNewTab() {
  if (isValidMediaUrl(previewImageUrl.value)) {
    window.open(previewImageUrl.value, '_blank', 'noopener,noreferrer');
  }
}

function downloadPreviewImage() {
  if (!isValidMediaUrl(previewImageUrl.value)) return;
  const url = previewImageUrl.value;
  const accountId = props.conversation?.zaloAccountId || props.conversation?.zaloAccount?.id || '';
  const target =
    url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/api/zalo/files/')
      ? url
      : `/api/zalo/files/download?url=${encodeURIComponent(url)}&accountId=${accountId}&mode=download&filename=${encodeURIComponent(`image_${Date.now()}.jpg`)}`;
  const link = document.createElement('a');
  link.href = target;
  link.download = `image_${Date.now()}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
const syncSnack = ref({ show: false, text: '', color: 'success' });
const showMediaPicker = ref(false);
const showBankCardModal = ref(false);
const showContactCardModal = ref(false);
const showZaloReminderModal = ref(false);

// ── Customer Status & Pinned Note (Lưu ý khách hàng / đơn hàng) ──
const CUSTOMER_STATUSES = CUSTOMER_STATUS_LIST;

const NOTE_PRESETS = [
  'Giao hàng sau 17h',
  'Yêu cầu xuất VAT',
  'Đã chuyển cọc',
  'Khách VIP ưu tiên',
  'Gọi trước khi giao',
  'Hẹn tư vấn lại',
];

const localStatusOverride = ref<string | null>(null);
const localPinnedNoteOverride = ref<string | null>(null);
const localPhoneOverride = ref<string | null>(null);
const localIsCustomerOverride = ref<boolean | null>(null);
const localQuoteCompletedOverride = ref<boolean | null>(null);

watch(() => props.conversation?.id, () => {
  localStatusOverride.value = null;
  localPinnedNoteOverride.value = null;
  localPhoneOverride.value = null;
  localIsCustomerOverride.value = null;
  localQuoteCompletedOverride.value = null;
});
watch(() => props.conversation?.contact?.status, () => { localStatusOverride.value = null; });
watch(() => [props.conversation?.contact?.notes, (props.conversation?.contact?.metadata as any)?.pinnedNote], () => { localPinnedNoteOverride.value = null; });
watch(() => props.conversation?.contact?.phone, () => { localPhoneOverride.value = null; });
watch(() => props.conversation?.isCustomer, () => { localIsCustomerOverride.value = null; });
watch(() => props.conversation?.quoteCompleted, () => { localQuoteCompletedOverride.value = null; });

const effectiveContactPhone = computed(() => {
  if (localPhoneOverride.value !== null) return localPhoneOverride.value;
  return props.conversation?.contact?.phone || '';
});

const effectiveIsCustomer = computed(() => {
  if (localIsCustomerOverride.value !== null) return localIsCustomerOverride.value;
  return Boolean(props.conversation?.isCustomer);
});

const effectiveQuoteCompleted = computed(() => {
  if (localQuoteCompletedOverride.value !== null) return localQuoteCompletedOverride.value;
  return Boolean(props.conversation?.quoteCompleted);
});

const currentCustomerStatus = computed(() => {
  if (localStatusOverride.value !== null) return localStatusOverride.value;
  return props.conversation?.contact?.status || 'new';
});

const currentPinnedNote = computed(() => {
  if (localPinnedNoteOverride.value !== null) return localPinnedNoteOverride.value;
  const meta = props.conversation?.contact?.metadata as any;
  if (meta?.pinnedNote && typeof meta.pinnedNote === 'string') {
    return meta.pinnedNote;
  }
  const rawNotes = props.conversation?.contact?.notes;
  if (rawNotes && typeof rawNotes === 'string' && !rawNotes.startsWith('[') && !rawNotes.includes('[chuyển cho')) {
    return rawNotes;
  }
  return '';
});

function getStatusMeta(statusVal: string) {
  return normalizeCustomerStatus(statusVal);
}

const noteTheme = useTheme();
const noteIsDark = computed(() => noteTheme.current.value.dark);
const pinnedNotePreview = ref<HTMLElement | null>(null);
const noteExpanded = ref(false);
const noteOverflows = ref(false);
let noteResizeObserver: ResizeObserver | null = null;
function measureNoteOverflow() {
  if (noteExpanded.value) return;
  const el = pinnedNotePreview.value;
  noteOverflows.value = !!el && el.scrollHeight > el.clientHeight + 1;
}
watch(pinnedNotePreview, el => {
  noteResizeObserver?.disconnect();
  if (el) { noteResizeObserver = new ResizeObserver(measureNoteOverflow); noteResizeObserver.observe(el); }
  void nextTick(measureNoteOverflow);
});
watch(() => [props.conversation?.id, currentPinnedNote.value], () => {
  noteExpanded.value = false; noteOverflows.value = false;
  void nextTick(measureNoteOverflow);
});
watch(noteExpanded, () => { void nextTick(measureNoteOverflow); });
onUnmounted(() => noteResizeObserver?.disconnect());

const showNoteDialog = ref(false);
const savingNote = ref(false);
const noteForm = ref({
  status: 'new',
  pinnedNote: '',
});

function openNoteDialog() {
  noteForm.value.status = currentCustomerStatus.value;
  noteForm.value.pinnedNote = currentPinnedNote.value;
  showNoteDialog.value = true;
}

function insertNotePreset(preset: string) {
  if (!noteForm.value.pinnedNote) {
    noteForm.value.pinnedNote = preset;
  } else if (!noteForm.value.pinnedNote.includes(preset)) {
    noteForm.value.pinnedNote = `${noteForm.value.pinnedNote}, ${preset}`;
  }
}

async function saveCustomerNote() {
  if (!props.conversation?.id) return;
  savingNote.value = true;
  try {
    const trimmedNote = noteForm.value.pinnedNote.trim();
    await api.patch(`/conversations/${props.conversation.id}/customer-note`, {
      status: noteForm.value.status,
      pinnedNote: trimmedNote,
    });
    localStatusOverride.value = noteForm.value.status;
    localPinnedNoteOverride.value = trimmedNote;
    emit('contact-updated');
    showNoteDialog.value = false;
    syncSnack.value = { show: true, text: 'Đã lưu và ghim lưu ý khách hàng thành công!', color: 'success' };
  } catch (err: any) {
    console.error('Failed to save customer note:', err);
    syncSnack.value = { show: true, text: err.response?.data?.error || 'Lưu ghi chú thất bại', color: 'error' };
  } finally {
    savingNote.value = false;
  }
}

function onContactStatusChangedEvent(e: Event) {
  const custom = e as CustomEvent;
  if (custom.detail?.conversationId === props.conversation?.id && custom.detail?.status) {
    localStatusOverride.value = custom.detail.status;
  }
}

onMounted(() => {
  window.addEventListener('crm:contact-status-changed', onContactStatusChangedEvent);
});

onUnmounted(() => {
  window.removeEventListener('crm:contact-status-changed', onContactStatusChangedEvent);
});

async function updateCustomerStatus(newStatus: string) {
  if (!props.conversation?.id) return;
  try {
    await api.patch(`/conversations/${props.conversation.id}/customer-note`, {
      status: newStatus,
    });
    localStatusOverride.value = newStatus;
    emit('contact-updated');
    // Broadcast status change so right panel updates immediately
    window.dispatchEvent(new CustomEvent('crm:contact-status-changed', {
      detail: { conversationId: props.conversation.id, status: newStatus }
    }));
    syncSnack.value = {
      show: true,
      text: `Đã cập nhật trạng thái: "${getStatusMeta(newStatus).text}"`,
      color: 'success',
    };
  } catch (err: any) {
    console.error('Failed to update status:', err);
    syncSnack.value = { show: true, text: 'Đổi trạng thái thất bại', color: 'error' };
  }
}

async function clearPinnedNote() {
  if (!props.conversation?.id) return;
  savingNote.value = true;
  try {
    await api.patch(`/conversations/${props.conversation.id}/customer-note`, {
      pinnedNote: '',
    });
    localPinnedNoteOverride.value = '';
    emit('contact-updated');
    showNoteDialog.value = false;
    syncSnack.value = { show: true, text: 'Đã gỡ lưu ý đã ghim', color: 'success' };
  } catch (err: any) {
    console.error('Failed to clear pinned note:', err);
    syncSnack.value = { show: true, text: 'Gỡ lưu ý thất bại', color: 'error' };
  } finally {
    savingNote.value = false;
  }
}

const showCallDialog = ref(false);
const callPhoneInput = ref('');
const isEditingCallPhone = ref(false);
const savingPhone = ref(false);

function openCallDialog() {
  callPhoneInput.value = effectiveContactPhone.value;
  isEditingCallPhone.value = !effectiveContactPhone.value;
  showCallDialog.value = true;
}

function handleMakePhoneCall(phoneToCall?: string) {
  const phone = (phoneToCall || effectiveContactPhone.value || callPhoneInput.value || '').replace(/\s+/g, '');
  if (!phone) {
    syncSnack.value = { show: true, text: 'Vui lòng nhập số điện thoại để gọi', color: 'warning' };
    return;
  }
  window.open(`tel:${phone}`, '_self');
  syncSnack.value = { show: true, text: `Đang mở cuộc gọi đến ${phone}...`, color: 'success' };
  showCallDialog.value = false;
}

function handleOpenZaloCall(phoneToCall?: string) {
  const phone = (phoneToCall || effectiveContactPhone.value || callPhoneInput.value || '').replace(/\s+/g, '');
  if (!phone) {
    syncSnack.value = { show: true, text: 'Không có số điện thoại để mở Zalo', color: 'warning' };
    return;
  }
  window.open(`https://zalo.me/${encodeURIComponent(phone)}`, '_blank', 'noopener,noreferrer');
}

async function handleSavePhoneAndCall() {
  const phone = callPhoneInput.value.trim();
  if (!phone) {
    syncSnack.value = { show: true, text: 'Vui lòng nhập số điện thoại', color: 'warning' };
    return;
  }
  if (props.conversation?.contact?.id) {
    savingPhone.value = true;
    try {
      await api.put(`/contacts/${props.conversation.contact.id}`, { phone });
      localPhoneOverride.value = phone;
      emit('contact-updated');
      isEditingCallPhone.value = false;
      syncSnack.value = { show: true, text: 'Đã lưu số điện thoại!', color: 'success' };
    } catch {
      // Continue even if save failed
    } finally {
      savingPhone.value = false;
    }
  }
  handleMakePhoneCall(phone);
}

function detectPhoneNumber(content: unknown): string | null {
  if (!content || typeof content !== 'string') return null;
  // Match VN phone number: 10 digits starting with 03, 05, 07, 08, 09 or +84
  const match = content.match(/(?:\+84|0)(?:3|5|7|8|9)(?:[0-9]{8}\b|[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}\b)/);
  if (match) {
    const raw = match[0].replace(/[\s.-]/g, '');
    const cleanPhone = raw.startsWith('+84') ? '0' + raw.slice(3) : raw;
    const currentPhone = effectiveContactPhone.value.replace(/[\s.-]/g, '');
    if (cleanPhone && cleanPhone.length === 10 && cleanPhone !== currentPhone) {
      return cleanPhone;
    }
  }
  return null;
}

async function quickSaveDetectedPhone(phone: string) {
  const contactId = props.conversation?.contact?.id || props.conversation?.contactId;
  if (!contactId) return;
  try {
    await api.put(`/contacts/${contactId}`, { phone });
    localPhoneOverride.value = phone;
    emit('contact-updated');
    syncSnack.value = { show: true, text: `Đã lưu số điện thoại ${phone} vào hồ sơ khách hàng!`, color: 'success' };
  } catch (e) {
    syncSnack.value = { show: true, text: 'Không thể lưu số điện thoại. Vui lòng thử lại.', color: 'error' };
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function onMediaSent() {
  syncSnack.value = { show: true, text: 'Đã gửi ảnh từ Kho thành công!', color: 'success' };
  nextTick(() => {
    scrollToBottom();
  });
}

const fileInput = ref<HTMLInputElement | null>(null);
const sendingFile = ref(false);
const updatingQuote = ref(false);

const shouldTrack = computed(() => {
  if (!props.conversation) return false;
  return props.conversation.threadType === 'user' || effectiveIsCustomer.value;
});

const isOverdue = computed(() => {
  if (!props.conversation || !shouldTrack.value || effectiveQuoteCompleted.value) return false;
  if (!props.conversation.lastMessageAt) return false;
  const lastTime = new Date(props.conversation.lastMessageAt).getTime();
  const diffHours = (Date.now() - lastTime) / (1000 * 60 * 60);
  return diffHours > 24;
});
void isOverdue;

const isUncompleted = computed(() => false);
void isUncompleted;

async function toggleQuoteCompleted() {
  if (!props.conversation) return;
  updatingQuote.value = true;
  try {
    const nextState = !effectiveQuoteCompleted.value;
    const res = await api.patch(`/conversations/${props.conversation.id}/quote-settings`, {
      quoteCompleted: nextState
    });
    localQuoteCompletedOverride.value = Boolean(res.data.quoteCompleted);
    emit('group-updated');
  } catch (err) {
    console.error('Failed to toggle quote status:', err);
  } finally {
    updatingQuote.value = false;
  }
}
void toggleQuoteCompleted;

function triggerFileInput() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  sendingFile.value = true;
  try {
    emit('send-file', file);
  } catch (err) {
    syncSnack.value = { show: true, text: 'Gửi file thất bại', color: 'error' };
  } finally {
    sendingFile.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

// ── Voice Recording State & Methods ─────────────────────────────────────────
const isRecordingVoice = ref(false);
const recordingDuration = ref(0);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingTimer: any = null;

function formatVoiceDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

async function startVoiceRecording() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      syncSnack.value = { show: true, text: 'Trình duyệt không hỗ trợ ghi âm trực tiếp', color: 'error' };
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    recordingDuration.value = 0;

    let mimeType = 'audio/webm;codecs=opus';
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else {
          mimeType = '';
        }
      }
    }

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(200);
    isRecordingVoice.value = true;
    recordingTimer = setInterval(() => {
      recordingDuration.value += 1;
    }, 1000);
  } catch (err: any) {
    console.error('Error starting audio recording:', err);
    syncSnack.value = {
      show: true,
      text: 'Không thể truy cập microphone: ' + (err.message || 'Vui lòng cấp quyền'),
      color: 'error'
    };
  }
}

function cancelVoiceRecording() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks().forEach((t) => t.stop());
  }
  isRecordingVoice.value = false;
  audioChunks = [];
  recordingDuration.value = 0;
}

async function sendVoiceRecording() {
  if (!mediaRecorder) return;
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  const durationSec = recordingDuration.value;
  isRecordingVoice.value = false;

  mediaRecorder.onstop = () => {
    try {
      mediaRecorder?.stream?.getTracks().forEach((t) => t.stop());

      if (audioChunks.length === 0) return;
      const mime = mediaRecorder?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: mime });
      audioChunks = [];

      let ext = 'webm';
      if (mime.includes('mp4') || mime.includes('m4a')) ext = 'm4a';
      else if (mime.includes('ogg') || mime.includes('opus')) ext = 'ogg';

      const audioFile = new File([audioBlob], `voice_record_${Date.now()}.${ext}`, { type: mime });
      emit('send-file', audioFile, formatVoiceDuration(durationSec));
    } catch (err: any) {
      console.error('Error sending recorded voice:', err);
      syncSnack.value = {
        show: true,
        text: 'Lỗi gửi tin nhắn thoại: ' + (err.message || 'Thử lại sau'),
        color: 'error'
      };
    }
  };

  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// ── Zalo Drag & Drop File/Image to Send (Image 1) ──────────────────────────
const isDraggingFile = ref(false);
const activeDropZone = ref<'quick' | 'preview' | null>(null);
const draggedFileLabel = ref<string>('');
let dragCounter = 0;

function handleContainerDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    dragCounter++;
    isDraggingFile.value = true;
    if (activeDropZone.value === null) {
      activeDropZone.value = 'quick';
    }
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      draggedFileLabel.value = `${items.length} tệp đính kèm`;
    } else {
      draggedFileLabel.value = 'Thả file / ảnh tại đây';
    }
  }
}

function handleContainerDragOver(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
}

function handleContainerDragLeave(_e: DragEvent) {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    isDraggingFile.value = false;
    activeDropZone.value = null;
  }
}

function handleContainerDrop(_e: DragEvent) {
  isDraggingFile.value = false;
  dragCounter = 0;
  activeDropZone.value = null;
}

function onDropQuickSend(e: DragEvent) {
  isDraggingFile.value = false;
  dragCounter = 0;
  activeDropZone.value = null;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    emit('send-file', files[i]);
  }
}

const previewSendDialog = reactive({
  show: false,
  file: null as File | null,
  previewUrl: '',
  caption: '',
  isImage: false,
});

function onDropPreviewSend(e: DragEvent) {
  isDraggingFile.value = false;
  dragCounter = 0;
  activeDropZone.value = null;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  previewSendDialog.file = file;
  previewSendDialog.isImage = file.type.startsWith('image/');
  previewSendDialog.previewUrl = previewSendDialog.isImage ? URL.createObjectURL(file) : '';
  previewSendDialog.caption = '';
  previewSendDialog.show = true;
}

function closePreviewSendDialog() {
  if (previewSendDialog.previewUrl) {
    URL.revokeObjectURL(previewSendDialog.previewUrl);
    previewSendDialog.previewUrl = '';
  }
  previewSendDialog.file = null;
  previewSendDialog.caption = '';
  previewSendDialog.show = false;
}

async function submitPreviewSend() {
  if (!previewSendDialog.file) return;
  const file = previewSendDialog.file;
  const caption = previewSendDialog.caption.trim();
  closePreviewSendDialog();
  emit('send-file', file, caption);
}

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function handleSend() {
  if (!inputText.value.trim()) return;
  const cleanText = inputText.value.replace(/^[\r\n]+/, '').trimEnd();
  emit('send', cleanText, replyingTo.value?.id);
  inputText.value = '';
  replyingTo.value = null;
}

function onSelectQuickReply(content: string) {
  if (inputText.value.trim()) {
    inputText.value = inputText.value + '\n' + content;
  } else {
    inputText.value = content;
  }
}

function onSendInstantQuickReply(content: string) {
  emit('send', content, replyingTo.value?.id);
  replyingTo.value = null;
}
function formatMessageTime(d: string) { return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }

function shouldShowDateDivider(index: number): boolean {
  if (index === 0) return true;
  const currentMsg = props.messages[index];
  const prevMsg = props.messages[index - 1];
  if (!currentMsg || !prevMsg) return false;
  
  const currentDate = new Date(currentMsg.sentAt).toDateString();
  const prevDate = new Date(prevMsg.sentAt).toDateString();
  
  return currentDate !== prevDate;
}

function formatDateDivider(sentAt: string): string {
  const date = new Date(sentAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Hôm nay';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Hôm qua';
  }
  
  const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const weekday = weekdays[date.getDay()];
  
  return `${weekday}, ${day}/${month}/${year}`;
}

function openFile(url: string) {
  if (!isValidMediaUrl(url)) return;
  if (url.startsWith('blob:') || url.startsWith('/api/zalo/files/')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const accountId = props.conversation?.zaloAccountId || props.conversation?.zaloAccount?.id || '';
  if (
    url.startsWith('/storage/') ||
    url.startsWith('/uploads/') ||
    url.startsWith('/api/zalo-assets/') ||
    (accountId && (url.includes('dlfl.vn') || url.includes('zalo') || url.includes('zdn.vn') || url.includes('asyncfile')))
  ) {
    const proxyUrl = `/api/zalo/files/download?url=${encodeURIComponent(url)}&accountId=${accountId}&mode=view`;
    window.open(proxyUrl, '_blank', 'noopener,noreferrer');
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Extract sender avatar for group messages */
function getSenderAvatar(msg: Message): string | null {
  if (msg.senderType === 'self') return null;
  if (msg.attachments) {
    let list: any[] = [];
    if (typeof msg.attachments === 'string') {
      try { list = JSON.parse(msg.attachments); } catch {}
    } else if (Array.isArray(msg.attachments)) {
      list = msg.attachments;
    }
    const senderObj = list.find((a: any) => a && (a.type === 'sender_avatar' || a.type === 'sender'));
    if (senderObj?.avatar) return senderObj.avatar;
  }
  return null;
}

function openImagePreview(msg: Message) {
  const full = getImageFullUrl(msg);
  const render = getRenderImageUrl(msg);
  previewImageUrl.value = (retriedPrimarySrcById.value[msg.id] ? render : full || render) || '';
  previewImageCaption.value = getImageCaption(msg) || '';
}

function getFileTypeCategory(ext: string): string {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'excel';
  if (['doc', 'docx'].includes(e)) return 'word';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) return 'image';
  return 'other';
}

function getFileIcon(ext: string): string {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return 'mdi-file-pdf-box';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'mdi-file-excel-box';
  if (['doc', 'docx'].includes(e)) return 'mdi-file-word-box';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'mdi-folder-zip';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) return 'mdi-file-image';
  return 'mdi-file-document-outline';
}

function quickViewFile(file: FileCardInfo) {
  if (!isValidMediaUrl(file.href)) {
    syncSnack.value = { show: true, text: 'Đang chuẩn bị tệp, vui lòng thử lại sau giây lát', color: 'info' };
    return;
  }
  if (file.href.startsWith('blob:')) {
    window.open(file.href, '_blank', 'noopener,noreferrer');
    return;
  }
  if (file.href.startsWith('/api/zalo/files/message-file/')) {
    const url = file.href.includes('?')
      ? `${file.href}&mode=view&filename=${encodeURIComponent(file.name)}`
      : `${file.href}?mode=view&filename=${encodeURIComponent(file.name)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const accountId = props.conversation?.zaloAccountId || props.conversation?.zaloAccount?.id || '';
  const proxyUrl = `/api/zalo/files/download?url=${encodeURIComponent(file.href)}&accountId=${accountId}&mode=view&filename=${encodeURIComponent(file.name)}`;
  window.open(proxyUrl, '_blank', 'noopener,noreferrer');
}

function downloadChatFile(file: FileCardInfo) {
  if (!isValidMediaUrl(file.href)) {
    syncSnack.value = { show: true, text: 'Đang chuẩn bị tệp, vui lòng thử lại sau giây lát', color: 'info' };
    return;
  }
  const accountId = props.conversation?.zaloAccountId || props.conversation?.zaloAccount?.id || '';
  let targetUrl = '';
  if (file.href.startsWith('/api/zalo/files/message-file/')) {
    targetUrl = file.href.includes('?')
      ? `${file.href}&mode=download&filename=${encodeURIComponent(file.name)}`
      : `${file.href}?mode=download&filename=${encodeURIComponent(file.name)}`;
  } else {
    targetUrl = `/api/zalo/files/download?url=${encodeURIComponent(file.href)}&accountId=${accountId}&mode=download&filename=${encodeURIComponent(file.name)}`;
  }
  const a = document.createElement('a');
  a.href = targetUrl;
  a.setAttribute('download', file.name);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Voice Audio Player State & Methods ─────────────────────────────────────
const activeVoiceMsgId = ref<string | null>(null);
const isVoicePlaying = ref(false);
const isVoiceLoadingState = ref(false);
const voiceCurrentTime = ref(0);
const voiceDuration = ref(0);
let currentAudio: HTMLAudioElement | null = null;

function isCurrentVoicePlaying(msg: Message): boolean {
  return activeVoiceMsgId.value === msg.id && isVoicePlaying.value;
}

function isVoiceLoading(msg: Message): boolean {
  return activeVoiceMsgId.value === msg.id && isVoiceLoadingState.value;
}

function getVoiceProgressPercent(msg: Message): number {
  if (activeVoiceMsgId.value !== msg.id) return 0;
  if (!voiceDuration.value || isNaN(voiceDuration.value)) return 0;
  return Math.min(100, (voiceCurrentTime.value / voiceDuration.value) * 100);
}

function formatVoiceTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function togglePlayVoice(msg: Message) {
  const info = getVoiceInfo(msg);
  if (!info || !info.url) return;

  if (activeVoiceMsgId.value === msg.id) {
    if (isVoicePlaying.value) {
      currentAudio?.pause();
      isVoicePlaying.value = false;
    } else {
      currentAudio?.play().catch(e => console.error('Audio play error:', e));
      isVoicePlaying.value = true;
    }
    return;
  }

  // Stop previous audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = null;
  }

  activeVoiceMsgId.value = msg.id;
  isVoicePlaying.value = false;
  isVoiceLoadingState.value = true;
  voiceCurrentTime.value = 0;
  voiceDuration.value = info.duration || 0;

  const audio = new Audio(info.url);
  currentAudio = audio;

  audio.addEventListener('loadedmetadata', () => {
    isVoiceLoadingState.value = false;
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      voiceDuration.value = audio.duration;
    }
  });

  audio.addEventListener('canplay', () => {
    isVoiceLoadingState.value = false;
  });

  audio.addEventListener('timeupdate', () => {
    voiceCurrentTime.value = audio.currentTime;
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      voiceDuration.value = audio.duration;
    }
  });

  audio.addEventListener('ended', () => {
    isVoicePlaying.value = false;
    voiceCurrentTime.value = 0;
  });

  audio.addEventListener('error', (err) => {
    console.error('Audio playback error:', err);
    isVoiceLoadingState.value = false;
    isVoicePlaying.value = false;
    syncSnack.value = { show: true, text: 'Không thể phát âm thanh', color: 'error' };
  });

  audio.play()
    .then(() => {
      isVoicePlaying.value = true;
      isVoiceLoadingState.value = false;
    })
    .catch((err) => {
      console.error('Playback start error:', err);
      isVoiceLoadingState.value = false;
      isVoicePlaying.value = false;
    });
}

function seekVoice(event: MouseEvent, msg: Message) {
  if (activeVoiceMsgId.value !== msg.id || !currentAudio || !voiceDuration.value) return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, clickX / rect.width));
  const newTime = percent * voiceDuration.value;
  currentAudio.currentTime = newTime;
  voiceCurrentTime.value = newTime;
}

function downloadVoice(msg: Message) {
  const info = getVoiceInfo(msg);
  if (!info?.url || !isValidMediaUrl(info.url)) return;
  window.open(info.url, '_blank', 'noopener,noreferrer');
}

onUnmounted(() => {
  cancelVoiceRecording();
  clearTimeout(saveTagsTimeout);
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
});

// ── Call Message Info ──────────────────────────────────────────────────────
export interface CallInfo {
  isMissed: boolean;
  isIncoming: boolean;
  duration: number;
  durationText: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

function isCallMessage(msg: Message): boolean {
  if (msg.contentType === 'call') return true;
  if (!msg.content || !msg.content.startsWith('{')) return false;
  try {
    const p = JSON.parse(msg.content);
    return Boolean(p.action?.includes('call') || p.title === 'sendBubbleMessage' || p.description === 'Cuộc gọi');
  } catch { return false; }
}

function getCallInfo(msg: Message): CallInfo | null {
  if (msg.contentType === 'call' || isCallMessage(msg)) {
    try {
      const p = typeof msg.content === 'string' && msg.content.startsWith('{') ? JSON.parse(msg.content) : null;
      let params = p?.params;
      if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }
      const duration = Number(params?.duration || 0);
      const isCaller = Number(params?.isCaller ?? (msg.senderType === 'self' ? 1 : 0));
      const isIncoming = isCaller === 0;
      const isMissed = duration === 0 || p?.action?.includes('misscall') || p?.action?.includes('miss');

      const m = Math.floor(duration / 60);
      const s = duration % 60;
      let durationText = '';
      if (duration > 0) {
        durationText = m > 0 ? `${m} phút ${s > 0 ? s + ' giây' : ''}` : `${s} giây`;
      }

      if (isMissed) {
        if (isIncoming) {
          return {
            isMissed: true,
            isIncoming: true,
            duration: 0,
            durationText: 'Cuộc gọi nhỡ',
            title: 'Cuộc gọi đến nhỡ',
            subtitle: 'Khách hàng đã gọi nhưng bạn chưa bắt máy',
            icon: 'mdi-phone-missed',
            color: '#EF4444',
          };
        } else {
          return {
            isMissed: true,
            isIncoming: false,
            duration: 0,
            durationText: 'Không bắt máy',
            title: 'Cuộc gọi đi không thành công',
            subtitle: 'Khách hàng không nhấc máy',
            icon: 'mdi-phone-cancel',
            color: '#F59E0B',
          };
        }
      } else {
        if (isIncoming) {
          return {
            isMissed: false,
            isIncoming: true,
            duration,
            durationText,
            title: 'Cuộc gọi thoại đến',
            subtitle: `Thời lượng cuộc gọi: ${durationText}`,
            icon: 'mdi-phone-incoming',
            color: '#10B981',
          };
        } else {
          return {
            isMissed: false,
            isIncoming: false,
            duration,
            durationText,
            title: 'Cuộc gọi thoại đi',
            subtitle: `Thời lượng cuộc gọi: ${durationText}`,
            icon: 'mdi-phone-outgoing',
            color: '#3B82F6',
          };
        }
      }
    } catch {}
  }
  return null;
}

// ── Bank Card Info ──────────────────────────────────────────────────────────
export interface BankCardInfo {
  binBank: string;
  bankName: string;
  numAccBank: string;
  nameAccBank: string;
  amount?: number;
  note?: string;
  vietQrUrl?: string;
}

function getBankCardInfo(msg: Message): BankCardInfo | null {
  if (msg.contentType === 'bank_card' || msg.content?.includes('bank_card') || msg.content?.includes('numAccBank')) {
    try {
      if (msg.content?.startsWith('{')) {
        const p = JSON.parse(msg.content);
        if (p.type === 'bank_card' || p.binBank || p.numAccBank) {
          const bin = p.binBank || (msg.metadata as any)?.binBank || '';
          const num = p.numAccBank || (msg.metadata as any)?.numAccBank || '';
          const name = p.nameAccBank || (msg.metadata as any)?.nameAccBank || '';
          const bank = p.bankName || (msg.metadata as any)?.bankName || 'Ngân hàng';
          const amt = p.amount ?? (msg.metadata as any)?.amount ?? 0;
          const note = p.note || (msg.metadata as any)?.note || '';
          const vietQrUrl = p.vietQrUrl || (bin && num ? `https://img.vietqr.io/image/${bin}-${num}-compact2.png?amount=${amt}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(name)}` : '');
          return {
            binBank: bin,
            bankName: bank,
            numAccBank: num,
            nameAccBank: name,
            amount: amt,
            note,
            vietQrUrl,
          };
        }
      }
    } catch {}
  }
  return null;
}

function openImagePreviewDirect(url: string, caption = '') {
  previewImageUrl.value = url;
  previewImageCaption.value = caption;
}

function copyToClipboard(text: string, label = 'Số tài khoản') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    syncSnack.value = { show: true, text: `Đã sao chép ${label}!`, color: 'success' };
  }).catch(() => {
    syncSnack.value = { show: true, text: 'Không thể sao chép', color: 'error' };
  });
}

function onRichMessageSent(_msg?: any) {
  syncSnack.value = { show: true, text: 'Đã gửi thành công!', color: 'success' };
  nextTick(() => {
    scrollToBottom();
  });
}

let lastTypingTime = 0;
function handleInputTyping() {
  const now = Date.now();
  if (now - lastTypingTime > 3000 && props.conversation?.id) {
    lastTypingTime = now;
    api.post(`/conversations/${props.conversation.id}/typing`).catch(() => {});
  }
}

// ── Contact Card Info ──────────────────────────────────────────────────────
export interface ContactCardInfo {
  name: string;
  phone?: string;
  avatar?: string;
  qrCodeUrl?: string;
  userId?: string;
}

function getContactCardInfo(msg: Message): ContactCardInfo | null {
  if (
    msg.contentType === 'contact_card' ||
    msg.content?.includes('recommened.user') ||
    msg.content?.includes('qrCodeUrl') ||
    (typeof msg.content === 'string' && msg.content.includes('"phone"') && msg.content.includes('"qrCodeUrl"'))
  ) {
    try {
      if (msg.content?.startsWith('{')) {
        const p = JSON.parse(msg.content);
        let params = p.params;
        if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }

        // Also check if p.description is stringified JSON (common in Zalo contact cards)
        let descObj: any = null;
        if (typeof p.description === 'string' && p.description.trim().startsWith('{')) {
          try { descObj = JSON.parse(p.description); } catch {}
        }

        const phone = descObj?.phone || params?.phone || (typeof p.description === 'string' && !p.description.trim().startsWith('{') ? p.description : '') || '';
        const qrCodeUrl = descObj?.qrCodeUrl || params?.qrCodeUrl || p.qrCodeUrl || '';
        const avatar = descObj?.avatar || p.thumb || params?.avatar || '';
        const name = descObj?.name || p.title || params?.name || (phone ? `Liên hệ ${phone}` : 'Danh thiếp Zalo');
        const userId = descObj?.userId || params?.userId || p.userId || '';

        return {
          name,
          phone,
          avatar,
          qrCodeUrl,
          userId,
        };
      }
    } catch {}
  }
  return null;
}

function getContactQrFallback(card: ContactCardInfo): string {
  if (card.qrCodeUrl) return card.qrCodeUrl;
  const target = card.phone ? `https://zalo.me/${card.phone.replace(/\s+/g, '')}` : (card.name || 'zalo');
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(target)}`;
}

function onContactCall(phone?: string) {
  if (!phone) {
    syncSnack.value = { show: true, text: 'Không có số điện thoại để gọi', color: 'warning' };
    return;
  }
  window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self');
}

function onContactMessage(card: ContactCardInfo) {
  if (card.phone) {
    window.open(`https://zalo.me/${card.phone.replace(/\s+/g, '')}`, '_blank');
  } else {
    syncSnack.value = { show: true, text: `Đã chọn liên hệ ${card.name}`, color: 'info' };
  }
}

// ── Link Card Info ─────────────────────────────────────────────────────────
export interface LinkInfo {
  url: string;
  title: string;
  description?: string;
  thumb?: string;
  domain?: string;
  badge?: string;
}

function formatLinkDomain(info: LinkInfo): string {
  if (info.domain) {
    return info.domain.startsWith('www.') ? info.domain : `www.${info.domain}`;
  }
  try {
    const host = new URL(info.url).hostname;
    return host.startsWith('www.') ? host : `www.${host}`;
  } catch {
    return info.url;
  }
}

function getLinkInfo(msg: Message): LinkInfo | null {
  if (msg.contentType === 'link' || msg.content?.startsWith('{')) {
    try {
      const p = typeof msg.content === 'string' && msg.content.startsWith('{') ? JSON.parse(msg.content) : null;
      if (p && p.href && (p.href.startsWith('http://') || p.href.startsWith('https://'))) {
        // Exclude image or raw media CDN files
        if (!p.href.includes('/gr/jpg/') && !p.href.includes('/no/jpg/') && !/\.(jpg|jpeg|png|webp|gif)$/i.test(p.href)) {
          let params = p.params;
          if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }
          let title = p.title || params?.mediaTitle || '';
          let description = p.description || params?.description || '';
          if (!title && description) {
            title = description;
            description = '';
          }
          if (!title || !String(title).trim()) title = p.href;

          let domain = '';
          try { domain = new URL(p.href).hostname.replace(/^www\./, ''); } catch {}

          const rawThumb = p.thumb || params?.icon || '';
          const thumb = isValidMediaUrl(rawThumb) ? rawThumb : '';

          let badge = '';
          if (domain.includes('facebook.com')) badge = 'Facebook Video';
          else if (domain.includes('shopee.vn')) badge = 'Shopee';
          else if (domain.includes('youtube.com') || domain.includes('youtu.be')) badge = 'YouTube';
          else if (domain.includes('tiktok.com')) badge = 'TikTok';

          return {
            url: p.href,
            title: String(title).trim(),
            description: String(description).trim(),
            thumb,
            domain,
            badge,
          };
        }
      }
    } catch {}
  }
  if (msg.contentType === 'link' && msg.content && /^https?:\/\/\S+$/i.test(msg.content.trim())) {
    const url = msg.content.trim();
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    return {
      url,
      title: url,
      domain,
    };
  }
  return null;
}

function parseDisplayContent(content: string | null): string {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('/9j/') || content.startsWith('data:image/'))) {
    return '';
  }
  if (content.includes('clientDelMsgId') || content.includes('globalDelMsgId') || content.includes('deleteMsg')) {
    return '🗑️ Tin nhắn đã thu hồi';
  }
  if (!content.startsWith('{')) return content;
  try {
    const p = JSON.parse(content);
    let params = p.params;
    if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }

    // If bank card
    if (p.type === 'bank_card' || p.binBank) {
      return `💳 Thẻ ngân hàng ${p.bankName || ''} - ${p.numAccBank || ''}`;
    }

    // If reminder
    if (p.action === 'msginfo.actionlist' || p.actionlist !== undefined) {
      return `⏰ Nhắc hẹn: ${p.title || ''}`;
    }

    // If call
    if (p.action?.includes('call') || p.title === 'sendBubbleMessage' || p.description === 'Cuộc gọi' || params?.callId !== undefined) {
      const dur = Number(params?.duration || 0);
      const isCaller = Number(params?.isCaller || 0);
      if (dur === 0 || p.action?.includes('miss')) {
        return isCaller === 1 ? '📞 Cuộc gọi nhỡ đi' : '📞 Cuộc gọi đến nhỡ';
      }
      return `📞 Cuộc gọi thoại (${dur > 60 ? Math.floor(dur / 60) + 'p' + (dur % 60) + 's' : dur + 's'})`;
    }

    // If voice
    if (p.action?.includes('voice') || (p.href && p.href.includes('voice-aac-dl'))) {
      const durMs = Number(params?.duration || 0);
      return durMs > 0 ? `🎤 Tin nhắn thoại (${Math.round(durMs / 1000)}s)` : '🎤 Tin nhắn thoại';
    }

    // If pinned message
    if (p.title && p.title.includes('đã ghim')) {
      return `📌 ${p.title}`;
    }

    // If it's an empty media object, never render {"href":"","thumb":"","hdUrl":""}
    if ('href' in p && 'thumb' in p && 'hdUrl' in p && !p.href && !p.thumb && !p.hdUrl && !p.localUrl) {
      return sanitizeMediaCaption(p.title) || sanitizeMediaCaption(p.caption) || '';
    }

    // If video payload
    if (p.videoUrl || params?.videoUrl || p.type === 'video' || /\.(mp4|mov|avi|mkv|webm)/i.test(p.href || params?.rawUrl || '')) {
      return `🎥 [Video] ${p.title || p.caption || ''}`.trim();
    }

    // If image payload
    if (
      p.childnumber !== undefined ||
      params?.convertible === 'jxl' ||
      (p.href && p.href.includes('zdn.vn')) ||
      /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)/i.test(p.href || params?.rawUrl || '')
    ) {
      return `🖼️ [Hình ảnh] ${p.title || p.caption || ''}`.trim();
    }

    const title = (p.title && p.title !== 'sendBubbleMessage' ? p.title : null) || params?.mediaTitle;
    if (title && p.href) return `🔗 ${title}`;
    if (title) return title;
    if (p.href) return `🔗 ${p.description || p.href}`;
    if (p.description) return p.description;
    if (p.msg) return p.msg;
    return '';
  } catch {
    if (content.startsWith('{')) {
      if (content.includes('zdn.vn') || /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)/i.test(content) || content.includes('childnumber')) {
        return '🖼️ [Hình ảnh]';
      }
      if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar)/i.test(content) || content.includes('fileExt') || content.includes('fType')) {
        return '📎 [Tệp đính kèm]';
      }
      if (/\.(mp4|mov|avi|webm)/i.test(content) || content.includes('videoUrl')) {
        return '🎥 [Video]';
      }
      const match = content.match(/https?:\/\/[^\s"'<>\\]+/);
      if (match) return `🔗 ${match[0]}`;
      return '[Tin nhắn đính kèm]';
    }
    return content;
  }
}

function getDeletedDisplay(msg: Message): string {
  if (msg.senderType === 'self') {
    return 'Bạn đã thu hồi một tin nhắn';
  }
  return 'Tin nhắn đã được thu hồi';
}

/** Render message text with auto-clickable hyperlinks */
function renderMessageText(content: string | null, msg?: Message): string {
  const display = parseDisplayContent(content);
  if (!display) {
    if (
      msg &&
      !msg.isDeleted &&
      msg.senderType !== 'self' &&
      (props.conversation?.contact?.fullName?.toLowerCase().includes('meta') ||
        msg.senderName?.toLowerCase().includes('meta') ||
        msg.senderUid?.includes('13135550002'))
    ) {
      return '<span class="font-italic text-medium-emphasis" style="opacity: 0.85;">[Phản hồi từ Meta AI]</span>';
    }
    return '';
  }
  // Escape HTML entities to prevent XSS
  const escaped = display
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  // Replace URLs with clickable anchors, stripping trailing punctuation/quotes
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(urlRegex, (rawUrl) => {
    let url = rawUrl;
    let trailing = '';
    while (url.length > 8) {
      const m = url.match(/(&quot;|&#039;|&gt;|[.,;:!?)])$/);
      if (!m) break;
      const ch = m[1];
      if (ch === ')') {
        const openCount = (url.match(/\(/g) || []).length;
        const closeCount = (url.match(/\)/g) || []).length;
        if (closeCount <= openCount) break;
      }
      trailing = ch + trailing;
      url = url.slice(0, -ch.length);
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; word-break: break-all;">${url}</a>${trailing}`;
  });
}

function isReminderMessage(msg: Message): boolean {
  if (msg.contentType === 'reminder') return true;
  if (!msg.content) return false;
  try { const p = JSON.parse(msg.content); return p.action === 'msginfo.actionlist' || p.actionlist !== undefined; } catch { return false; }
}

function getReminderTitle(msg: Message): string {
  if ((msg.metadata as any)?.title) return (msg.metadata as any).title;
  try { return JSON.parse(msg.content!).title || ''; } catch { return msg.content || ''; }
}

function getReminderTime(msg: Message): string | null {
  const metaTime = (msg.metadata as any)?.startTime;
  if (metaTime && metaTime > 1e12) {
    return new Date(metaTime).toLocaleString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  try {
    const p = JSON.parse(msg.content!);
    const params = typeof p.params === 'string' ? JSON.parse(p.params) : p.params;
    for (const h of (params?.highLightsV2 || [])) {
      if (h.ts > 1e12) return new Date(h.ts).toLocaleString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  } catch {}
  return null;
}

/** Sync Zalo reminder to CRM appointments via API */
async function syncAppointment(msg: Message) {
  if (!props.conversation?.contact?.id) { syncSnack.value = { show: true, text: 'Không có thông tin khách hàng', color: 'error' }; return; }
  try {
    const p = JSON.parse(msg.content!);
    const params = typeof p.params === 'string' ? JSON.parse(p.params) : p.params;
    let appointmentDate: string | null = null;
    for (const h of (params?.highLightsV2 || [])) {
      if (h.ts > 1e12) { appointmentDate = new Date(h.ts).toISOString(); break; }
    }
    if (!appointmentDate) { syncSnack.value = { show: true, text: 'Không tìm thấy thời gian hẹn', color: 'warning' }; return; }
    await api.post('/appointments', {
      contactId: props.conversation.contact.id,
      appointmentDate,
      appointmentTime: new Date(appointmentDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      type: 'tai_kham',
      notes: `[Zalo] ${p.title || ''}`,
    });
    syncSnack.value = { show: true, text: 'Đã đồng bộ lịch hẹn thành công!', color: 'success' };
  } catch (err: any) {
    syncSnack.value = { show: true, text: err.response?.data?.error || 'Đồng bộ thất bại', color: 'error' };
  }
}

let prevScrollHeight = 0;
let prevScrollTop = 0;

function onMessagesContainerScroll(e: Event) {
  const target = e.target as HTMLElement;
  if (!target) return;
  // Khi cuộn sát đỉnh (<= 30px) và có tin nhắn cũ hơn chưa tải thì tự động tải thêm
  if (target.scrollTop <= 30 && props.hasOlderMessages && !props.loadingOlder) {
    triggerLoadOlder();
  }
}

function triggerLoadOlder() {
  if (props.loadingOlder || !props.hasOlderMessages) return;
  if (messagesContainer.value) {
    prevScrollHeight = messagesContainer.value.scrollHeight;
    prevScrollTop = messagesContainer.value.scrollTop;
  }
  emit('load-older');
}

watch(() => props.messages.length, async (newLen, oldLen) => {
  await nextTick();
  if (!messagesContainer.value) return;
  if (prevScrollHeight > 0 && newLen > (oldLen || 0)) {
    // Giữ nguyên vị trí cuộn khi tin nhắn cũ được chèn lên đầu
    const diff = messagesContainer.value.scrollHeight - prevScrollHeight;
    messagesContainer.value.scrollTop = prevScrollTop + diff;
    prevScrollHeight = 0;
  } else if (!oldLen && newLen > 0) {
    // Tải lần đầu: cuộn xuống tin nhắn mới nhất ở cuối
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
});

function getStaffColor(name: string | null | undefined): string {
  if (!name) return '#007AFF';
  if (['adameva', 'eva'].includes(name.toLowerCase())) {
    return '#E11D48'; // Rich rose-red for Eva AI
  }
  if (name.toLowerCase() === 'adam eva') {
    return '#059669'; // Rich emerald green for Adam Eva human replies
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#0284C7', // Sky blue
    '#2563EB', // Royal blue
    '#D97706', // Rich amber
    '#7C3AED', // Deep purple
    '#059669', // Emerald
    '#E11D48', // Rose red
    '#EA580C', // Deep orange
    '#0D9488', // Deep teal
    '#9333EA', // Violet
    '#4F46E5', // Indigo
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

async function toggleGroupTracking() {
  if (!props.conversation) return;
  updatingQuote.value = true;
  try {
    const nextState = !effectiveIsCustomer.value;
    const res = await api.patch(`/conversations/${props.conversation.id}/quote-settings`, {
      isCustomer: nextState
    });
    localIsCustomerOverride.value = Boolean(res.data.isCustomer);
    localQuoteCompletedOverride.value = Boolean(res.data.quoteCompleted);
    emit('group-updated');
  } catch (err) {
    console.error('Failed to toggle group tracking:', err);
  } finally {
    updatingQuote.value = false;
  }
}

defineExpose({
  insertText(text: string) {
    if (inputText.value && inputText.value.trim()) {
      inputText.value = inputText.value + '\n' + text;
    } else {
      inputText.value = text;
    }
  },
  setInputText(text: string) {
    inputText.value = text;
  }
});
</script>


<style scoped src="./MessageThread.css"></style>
