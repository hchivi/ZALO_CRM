<template>
  <v-app class="crm-shell" :class="{ 'liquid-bg': isDark }">
    <!-- Sticky alarm banner if Zalo accounts are disconnected -->
    <v-system-bar
      v-if="disconnectedAccounts.length > 0"
      color="error"
      class="justify-center font-weight-bold text-white px-2 px-sm-4 crm-disconnected-bar"
      :height="mobile ? 40 : 38"
      style="z-index: 1009; background: linear-gradient(90deg, #d32f2f, #ff5722) !important;"
    >
      <v-icon icon="mdi-alert-circle" size="16" class="mr-1 mr-sm-2 flex-shrink-0 animate-pulse" color="white" />
      <span class="text-caption font-weight-bold text-truncate crm-disconnected-text">
        CẢNH BÁO: Phát hiện Zalo [ {{ disconnectedAccounts.map(a => a.displayName || 'Zalo').join(', ') }} ] bị mất kết nối!
      </span>
      <v-btn
        color="white"
        variant="flat"
        size="x-small"
        class="ml-2 ml-sm-3 flex-shrink-0 font-weight-bold text-error px-2 rounded-pill"
        style="height: 22px; font-size: 0.68rem;"
        to="/cskh/zalo-accounts"
      >
        KẾT NỐI LẠI
      </v-btn>
    </v-system-bar>

    <!-- Top bar — Clean executive header -->
    <v-app-bar density="comfortable" flat class="crm-topbar" :class="[`theme-topbar--${currentTheme}`]">
      <v-app-bar-nav-icon
        @click="toggleSidebar"
        :title="!mobile && rail ? 'Mở rộng sidebar (Ctrl+B)' : 'Thu gọn sidebar (Ctrl+B)'"
      />

      <!-- Custom Brand Logo + Title -->
      <div class="d-flex align-center flex-shrink-0" :style="{ gap: mobile ? '6px' : '10px', marginLeft: mobile ? '2px' : '8px' }">
        <img v-if="orgLogo" :src="orgLogo" alt="CHUỖI CUNG ỨNG" :style="{ width: mobile ? '26px' : '32px', height: mobile ? '26px' : '32px', objectFit: 'contain' }" />
        <img v-else :src="portalLogo" alt="CHUỖI CUNG ỨNG" :style="{ width: mobile ? '26px' : '32px', height: mobile ? '26px' : '32px', objectFit: 'contain' }" />
        <v-app-bar-title v-if="!mobile" class="ml-0">
          <span class="font-weight-bold" style="font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.3px; font-size: 1.08rem; color: #003B2B;">
            <span class="brand-title-prefix">CHUỖI CUNG ỨNG</span>
          </span>
        </v-app-bar-title>
      </div>

      <v-spacer />
      <span class="workspace-role-label">Sales · Khách hàng &amp; CSKH</span>

      <!-- Brand Switcher: Multi-Select with Checkboxes -->
      <div class="workspace-brand-container">
        <v-menu
          v-model="brandMenuOpen"
          :close-on-content-click="false"
          location="bottom end"
          transition="scale-transition"
          :offset="6"
        >
          <template #activator="{ props: menuProps }">
            <button
              type="button"
              v-bind="menuProps"
              class="workspace-brand-btn"
              :class="{ 'workspace-brand-btn--active': isCustomBrandSelected }"
              aria-haspopup="true"
              :aria-expanded="brandMenuOpen"
              aria-label="Chọn không gian thương hiệu"
              title="Không gian thương hiệu CSKH (tick chọn 1 hoặc nhiều Brand)"
            >
              <span class="brand-status-dot" :class="brandDotClass"></span>
              <span class="brand-btn-text">{{ brandButtonLabel }}</span>
              <v-icon size="16" class="brand-chevron" :class="{ 'brand-chevron--rotated': brandMenuOpen }">
                mdi-chevron-down
              </v-icon>
            </button>
          </template>

          <v-card class="brand-dropdown-card" width="275" max-width="calc(100vw - 16px)" rounded="xl" elevation="8">
            <div class="brand-dropdown-header">
              <span class="brand-dropdown-title">KHÔNG GIAN THƯƠNG HIỆU</span>
            </div>

            <form ref="brandSwitchFormRef" action="/brand-switch" method="post" class="brand-switch-form">
              <input type="hidden" name="_token" :value="appConfig.csrfToken" />

              <!-- Option: Tất cả Brand (Mặc định) -->
              <div
                class="brand-select-item"
                :class="{ 'brand-select-item--active': isAllBrandsSelected }"
                @click="selectAllBrands"
              >
                <div class="brand-item-left">
                  <div class="brand-custom-checkbox" :class="{ 'brand-custom-checkbox--checked': isAllBrandsSelected }">
                    <v-icon v-if="isAllBrandsSelected" size="13" color="white">mdi-check</v-icon>
                  </div>
                  <span class="brand-item-dot brand-item-dot--purple"></span>
                  <span class="brand-item-name">Tất cả Brand</span>
                </div>
                <span v-if="isAllBrandsSelected" class="brand-badge-default">Mặc định</span>
              </div>

              <div class="brand-dropdown-divider"></div>

              <!-- List of Brands with Checkboxes -->
              <div class="brand-items-list">
                <div
                  v-for="b in appConfig.brands"
                  :key="b.id"
                  class="brand-select-item"
                  :class="{ 'brand-select-item--active': selectedBrandIds.includes(b.id) && !isAllBrandsSelected }"
                  @click="toggleBrandItem(b.id)"
                >
                  <div class="brand-item-left">
                    <div class="brand-custom-checkbox" :class="{ 'brand-custom-checkbox--checked': selectedBrandIds.includes(b.id) && !isAllBrandsSelected }">
                      <v-icon v-if="selectedBrandIds.includes(b.id) && !isAllBrandsSelected" size="13" color="white">mdi-check</v-icon>
                    </div>
                    <span class="brand-item-dot brand-item-dot--emerald"></span>
                    <span class="brand-item-name">{{ b.name }}</span>
                  </div>
                  <v-icon
                    v-if="selectedBrandIds.includes(b.id) && !isAllBrandsSelected"
                    size="15"
                    color="#10B981"
                  >
                    mdi-check
                  </v-icon>
                </div>
              </div>

              <!-- Footer with Reset and Apply button -->
              <div class="brand-dropdown-footer">
                <button
                  type="button"
                  class="btn-reset-all"
                  @click="selectAllBrandsAndSubmit"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  class="btn-apply-brands"
                  @click="submitBrandSelection"
                >
                  <span>Áp dụng</span>
                  <span v-if="!isAllBrandsSelected && selectedBrandIds.length > 0" class="apply-count-pill">
                    {{ selectedBrandIds.length }}
                  </span>
                </button>
              </div>
            </form>
          </v-card>
        </v-menu>
      </div>
      <v-btn v-if="authStore.isAdmin || authStore.user?.role === 'accountant'" href="/crm/cskh/needs" class="btn-accountant-link" size="small" prepend-icon="mdi-file-document-check-outline" title="Khu kế toán: Nhu cầu từ Sales">
        <span class="btn-accountant-text">Kế toán</span>
      </v-btn>
      <v-btn href="/dashboard" class="btn-portal-back" size="small" prepend-icon="mdi-arrow-left" title="Trở về portal gốc">
        <span>Portal</span>
      </v-btn>
    </v-app-bar>

    <!-- Sidebar navigation -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="!mobile && rail"
      :permanent="!mobile"
      :temporary="mobile"
      :width="225"
      :rail-width="68"
      style="z-index: 1009;"
      class="custom-app-sidebar"
      :class="[`theme-sidebar--${currentTheme}`]"
      @mouseenter="onSidebarMouseEnter"
      @mousemove="onSidebarActivity"
      @click="onSidebarActivity"
      @focusin="onSidebarActivity"
      @mouseleave="onSidebarMouseLeave"
    >
      <!-- Consolidated Connected Accounts (Dồn toàn bộ tài khoản kết nối thành 1) -->
      <section class="connected-accounts" aria-label="Tài khoản kết nối">
        <div v-if="!rail || mobile" class="connections-heading">
          <span class="menu-group-header">TÀI KHOẢN KẾT NỐI <span class="connection-total">{{ accounts.length }}</span></span>
          <v-btn v-if="authStore.isAdmin" icon="mdi-plus" size="x-small" variant="tonal" color="primary" title="Thêm tài khoản Zalo" aria-label="Thêm tài khoản Zalo" @click="navigateTo('/zalo-accounts?add=1')" />
        </div>

        <v-menu v-model="accountMenuOpen" location="end" :offset="10" transition="slide-x-transition">
          <template #activator="{ props: menuProps }">
            <!-- Dồn thành 1 nút avatar duy nhất khi thu gọn (Rail) -->
            <div
              v-if="rail && !mobile"
              v-bind="menuProps"
              class="consolidated-account-rail"
              :class="{ 'consolidated-account-rail--active': isChatRoute && sidebarAccountId }"
            >
              <span class="account-avatar" :class="{ 'account-avatar--whatsapp': currentActiveAccount?.channel === 'whatsapp' }">
                <img v-if="currentActiveAccount?.avatarUrl" :src="currentActiveAccount.avatarUrl" alt="" class="account-avatar-img" />
                <span v-else-if="currentActiveAccount?.channel === 'whatsapp'" class="account-avatar-wa-icon" title="WhatsApp">
                  <v-icon size="19" color="#FFFFFF">mdi-whatsapp</v-icon>
                </span>
                <span v-else-if="currentActiveAccount">{{ (currentActiveAccount.displayName || 'Z').trim().charAt(0).toUpperCase() }}</span>
                <span v-else class="account-avatar-composite" title="Tất cả tài khoản">
                  <v-icon size="20" color="#34D399">mdi-account-multiple</v-icon>
                </span>
                <i class="account-status account-status--online" />
              </span>
              <span class="rail-account-badge" :title="accounts.length + ' tài khoản kết nối'">{{ accounts.length }}</span>
              <v-tooltip activator="parent" location="right">
                {{ currentActiveAccount ? currentActiveAccount.displayName : 'Tất cả tài khoản (' + accounts.length + ')' }} · Bấm để đổi
              </v-tooltip>
            </div>

            <!-- Dồn thành 1 thẻ selector duy nhất khi mở rộng -->
            <div
              v-else
              v-bind="menuProps"
              class="consolidated-account-expanded"
              :class="{ 'consolidated-account-expanded--active': isChatRoute && sidebarAccountId }"
            >
              <span class="account-avatar" :class="{ 'account-avatar--whatsapp': currentActiveAccount?.channel === 'whatsapp' }">
                <img v-if="currentActiveAccount?.avatarUrl" :src="currentActiveAccount.avatarUrl" alt="" class="account-avatar-img" />
                <span v-else-if="currentActiveAccount?.channel === 'whatsapp'" class="account-avatar-wa-icon">
                  <v-icon size="19" color="#FFFFFF">mdi-whatsapp</v-icon>
                </span>
                <span v-else-if="currentActiveAccount">{{ (currentActiveAccount.displayName || 'Z').trim().charAt(0).toUpperCase() }}</span>
                <span v-else class="account-avatar-composite">
                  <v-icon size="20" color="#34D399">mdi-account-multiple</v-icon>
                </span>
                <i class="account-status account-status--online" />
              </span>
              <div class="consolidated-account-info text-truncate">
                <div class="text-caption font-weight-bold text-truncate text-white" style="letter-spacing: -0.2px;">
                  {{ currentActiveAccount ? currentActiveAccount.displayName : 'Tất cả tài khoản' }}
                </div>
                <div class="text-caption text-emerald-200" style="font-size: 10.5px; opacity: 0.85;">
                  {{ currentActiveAccount ? (currentActiveAccount.channel === 'whatsapp' ? 'WhatsApp CRM' : 'Zalo CRM') : accounts.length + ' tài khoản kết nối' }}
                </div>
              </div>
              <v-icon size="16" color="#A7F3D0" class="ml-auto">mdi-chevron-down</v-icon>
            </div>
          </template>

          <!-- Menu danh sách chọn tài khoản khi bấm vào -->
          <v-list density="compact" rounded="xl" width="250" max-width="calc(100vw - 24px)" class="elevation-12 pa-2 crm-account-menu">
            <v-list-subheader class="text-uppercase font-weight-bold text-caption pb-1" style="color: #64756D;">
              Chọn Tài Khoản CSKH
            </v-list-subheader>

            <v-list-item
              :active="!sidebarAccountId"
              rounded="lg"
              class="mb-1"
              @click="selectSidebarAccount(null)"
            >
              <template #prepend>
                <v-avatar size="32" color="#003B2B" class="mr-2">
                  <v-icon size="18" color="#34D399">mdi-account-multiple</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-bold text-body-2">Tất cả tài khoản</v-list-item-title>
              <v-list-item-subtitle class="text-caption text-grey">{{ accounts.length }} tài khoản đang kết nối</v-list-item-subtitle>
              <template #append v-if="!sidebarAccountId">
                <v-icon size="18" color="success">mdi-check</v-icon>
              </template>
            </v-list-item>

            <v-divider class="my-1" />

            <v-list-item
              v-for="acc in accounts"
              :key="acc.id"
              :active="sidebarAccountId === acc.id"
              rounded="lg"
              class="mb-1"
              @click="selectSidebarAccount(acc.id)"
            >
              <template #prepend>
                <v-avatar size="32" class="mr-2" :color="acc.channel === 'whatsapp' ? '#25D366' : '#0068FF'">
                  <img v-if="acc.avatarUrl" :src="acc.avatarUrl" alt="" style="width: 100%; height: 100%; object-fit: cover;" />
                  <v-icon v-else-if="acc.channel === 'whatsapp'" size="18" color="white">mdi-whatsapp</v-icon>
                  <span v-else class="text-caption font-weight-bold text-white">{{ (acc.displayName || 'Z').charAt(0).toUpperCase() }}</span>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-medium text-body-2 text-truncate">
                {{ acc.displayName || (acc.channel === 'whatsapp' ? 'WhatsApp' : 'Tài khoản Zalo') }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption text-grey">
                {{ acc.channel === 'whatsapp' ? 'WhatsApp CRM' : 'Zalo CRM' }}
              </v-list-item-subtitle>
              <template #append v-if="sidebarAccountId === acc.id">
                <v-icon size="18" color="success">mdi-check</v-icon>
              </template>
            </v-list-item>

            <template v-if="authStore.isAdmin">
              <v-divider class="my-1" />
              <v-list-item rounded="lg" @click="navigateTo('/zalo-accounts?add=1')">
                <template #prepend>
                  <v-icon size="18" color="primary" class="mr-2">mdi-plus-circle-outline</v-icon>
                </template>
                <v-list-item-title class="text-body-2 text-primary font-weight-bold">
                  Thêm tài khoản
                </v-list-item-title>
              </v-list-item>
            </template>
          </v-list>
        </v-menu>
      </section>

      <v-list density="compact" nav class="px-2 pt-2.5 pb-2 sidebar-navigation">
        <div v-for="group in filteredMenuGroups" :key="group.title" class="mb-2">
          <button v-if="group.title === 'Tổng quan'" class="system-group-toggle menu-group-header" :aria-expanded="overviewExpanded" aria-controls="sidebar-overview-items" :aria-label="overviewExpanded ? 'Thu gọn Tổng quan' : 'Mở rộng Tổng quan'" @click="overviewExpanded = !overviewExpanded">
            <span v-if="!rail || mobile">TỔNG QUAN</span><v-icon v-else size="18">mdi-view-quilt-outline</v-icon>
            <v-icon size="16">{{ overviewExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
          </button>
          <button v-else-if="group.title === 'Hệ thống'" class="system-group-toggle menu-group-header" :aria-expanded="systemExpanded" aria-controls="sidebar-system-items" @click="systemExpanded = !systemExpanded" :aria-label="systemExpanded ? 'Thu gọn Hệ thống' : 'Mở rộng Hệ thống'" :title="systemExpanded ? 'Thu gọn Hệ thống' : 'Mở rộng Hệ thống'">
            <span v-if="!rail || mobile">HỆ THỐNG</span><v-icon v-else size="18">mdi-cog-outline</v-icon>
            <v-icon size="16">{{ systemExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
          </button>
          <button v-else-if="group.title === 'Trạng thái'" class="system-group-toggle menu-group-header" :aria-expanded="statusExpanded" aria-controls="sidebar-status-items" @click="statusExpanded = !statusExpanded" :aria-label="statusExpanded ? 'Thu gọn Trạng thái' : 'Mở rộng Trạng thái'" :title="statusExpanded ? 'Thu gọn Trạng thái' : 'Mở rộng Trạng thái'">
            <span v-if="!rail || mobile">TRẠNG THÁI</span><v-icon v-else size="18">mdi-filter-variant</v-icon>
            <v-icon size="16">{{ statusExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
          </button>
          <div v-else-if="!rail || mobile" class="text-uppercase font-weight-bold px-3 py-1 menu-group-header" style="font-size: 0.72rem; letter-spacing: 0.6px;">{{ group.title }}</div>
          <v-divider v-else class="my-2 mx-2 opacity-20" />

          <div v-show="group.title === 'Hệ thống' ? systemExpanded : group.title === 'Tổng quan' ? overviewExpanded : group.title === 'Trạng thái' ? statusExpanded : true" :id="group.title === 'Hệ thống' ? 'sidebar-system-items' : group.title === 'Tổng quan' ? 'sidebar-overview-items' : group.title === 'Trạng thái' ? 'sidebar-status-items' : undefined">
            <v-list-item v-for="item in group.items" :key="item.path" :active="isMenuItemActive(item)" :title="!rail || mobile ? item.title : undefined" class="mb-1 nav-item" :class="{ 'category-nav-item': item.categoryColor }" @click="navigateTo(item.path)">
              <template #prepend>
                <v-icon :icon="item.icon" :style="{ color: item.color || item.categoryColor }" size="19" />
              </template>
              <template #append v-if="menuBadge(item) > 0">
                <span v-if="!mobile && rail" class="rail-badge-dot bg-primary" />
                <span v-else class="nav-count" :class="{ 'nav-count--warning': item.badge === 'tracked', 'nav-count--needs': item.badge === 'needs' }">{{ menuBadge(item) > 99 ? '99+' : menuBadge(item) }}</span>
              </template>
              <v-tooltip activator="parent" location="right" :disabled="!rail || mobile">{{ item.title }}<span v-if="menuBadge(item)"> · {{ menuBadge(item) }}</span></v-tooltip>
            </v-list-item>

            <!-- System Controls (Merged from image 1) -->
            <template v-if="group.title === 'Hệ thống'">
              <!-- User Profile & Attendance Card (Expanded view) -->
              <div v-if="authStore.user && (!rail || mobile)" class="system-user-box pa-1.5 mb-1.5 rounded-lg">
                <!-- User name & Online badge -->
                <div class="d-flex align-center justify-space-between mb-2">
                  <div class="d-flex align-center" style="gap: 8px;">
                    <span class="user-avatar-badge">
                      <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="" class="user-avatar-img" />
                      <span v-else>{{ (authStore.user.fullName || 'U').charAt(0).toUpperCase() }}</span>
                    </span>
                    <div style="min-width: 0;">
                      <div class="d-flex align-center" style="gap: 5px;">
                        <span class="user-online-dot" />
                        <span class="text-body-2 font-weight-bold text-truncate" style="letter-spacing: -0.2px; color: #FFFFFF !important;">{{ authStore.user.fullName }}</span>
                      </div>
                      <span class="user-role-label text-caption" style="font-size: 11px; color: #FFFFFF !important; opacity: 0.9;">{{ authStore.isAdmin ? 'Quản trị viên' : 'Nhân viên' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Quick Control Dock (Notifications, Theme, Push, Sound, Logout) -->
              <div v-if="!rail || mobile" class="system-quick-dock d-flex align-center justify-space-around py-1 px-1 mb-2">
                <!-- Notification Bell -->
                <div class="dock-btn-wrap" title="Thông báo">
                  <NotificationBell />
                </div>

                <!-- Theme Switcher Menu -->
                <v-menu transition="slide-y-transition" :open-on-hover="!mobile" :close-delay="mobile ? 0 : 100">
                  <template #activator="{ props }">
                    <v-btn icon size="small" variant="text" v-bind="props" class="dock-btn" title="Đổi chủ đề" aria-label="Đổi chủ đề">
                      <v-icon size="18">mdi-palette-outline</v-icon>
                    </v-btn>
                  </template>
                  <v-list density="compact" rounded="xl" width="220" max-width="calc(100vw - 24px)" class="elevation-10 mt-1 pa-2">
                    <v-list-subheader class="text-uppercase font-weight-bold text-caption pb-1">Chọn Giao Diện</v-list-subheader>
                    <v-list-item
                      v-for="item in themeOptions"
                      :key="item.id"
                      @click="changeTheme(item.id)"
                      :active="currentTheme === item.id"
                      rounded="lg"
                      class="mb-1"
                    >
                      <template #prepend>
                        <v-avatar size="24" :color="item.color" class="mr-2 border-sm">
                          <v-icon v-if="currentTheme === item.id" size="14" color="white">mdi-check</v-icon>
                        </v-avatar>
                      </template>
                      <v-list-item-title class="font-weight-bold text-body-2">{{ item.title }}</v-list-item-title>
                    </v-list-item>
                    <v-divider class="my-1" />
                    <v-list-item @click="resetToOriginalDefaults" rounded="lg" class="mb-1 text-error">
                      <template #prepend>
                        <v-avatar size="24" class="mr-2 border-sm bg-error-lighten-5">
                          <v-icon size="14" color="error">mdi-refresh</v-icon>
                        </v-avatar>
                      </template>
                      <v-list-item-title class="font-weight-bold text-body-2 text-error">Khôi phục mặc định</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>

                <!-- Push Notification Toggle -->
                <v-btn
                  v-if="notificationsSupported"
                  icon
                  size="small"
                  variant="text"
                  class="dock-btn"
                  @click="toggleNotifications"
                  :title="notificationsEnabled ? 'Tắt thông báo đẩy' : 'Bật thông báo đẩy'"
                  aria-label="Thông báo đẩy"
                >
                  <v-icon size="18" :class="{ 'dock-icon--active': notificationsEnabled }">
                    {{ notificationsEnabled ? 'mdi-bell-ring-outline' : 'mdi-bell-off-outline' }}
                  </v-icon>
                </v-btn>

                <!-- Sound Toggle -->
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  class="dock-btn"
                  @click="toggleSound"
                  :title="soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'"
                  aria-label="Âm thanh"
                >
                  <v-icon size="18" :class="{ 'dock-icon--active': soundEnabled }">
                    {{ soundEnabled ? 'mdi-volume-high' : 'mdi-volume-off' }}
                  </v-icon>
                </v-btn>

                <!-- Logout Button -->
                <v-btn icon size="small" variant="text" class="dock-btn dock-btn--logout" @click="logout" title="Đăng xuất" aria-label="Đăng xuất">
                  <v-icon size="18">mdi-logout</v-icon>
                </v-btn>
              </div>

              <!-- Rail compact controls when sidebar is rail mode -->
              <template v-if="rail && !mobile">
                <v-list-item
                  role="button"
                  tabindex="0"
                  prepend-icon="mdi-logout"
                  title="Đăng xuất"
                  class="mb-1 nav-item text-error"
                  aria-label="Đăng xuất"
                  @click="logout"
                >
                  <v-tooltip activator="parent" location="right">Đăng xuất</v-tooltip>
                </v-list-item>
              </template>

              <!-- Rail collapse toggle item -->
              <v-list-item
                v-if="!mobile"
                role="button"
                :prepend-icon="rail ? 'mdi-chevron-double-right' : 'mdi-chevron-double-left'"
                :title="!rail ? 'Thu gọn thanh bên' : undefined"
                class="nav-collapse-btn"
                :aria-label="rail ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
                @click="rail = !rail"
              >
                <template #append v-if="!rail"><span class="sidebar-shortcut">Ctrl+B</span></template>
                <v-tooltip activator="parent" location="right" :disabled="!rail">Mở rộng thanh bên (Ctrl+B)</v-tooltip>
              </v-list-item>
            </template>
          </div>
        </div>
      </v-list>
    </v-navigation-drawer>

    <!-- Main content -->
    <v-main>
      <v-container fluid class="crm-content" :class="{ 'crm-content--chat': isChatRoute }">
        <slot />
      </v-container>
    </v-main>

    <!-- Friend Request Toast Notification -->
    <v-snackbar
      v-model="showFriendRequestToast"
      color="purple-darken-3"
      timeout="8000"
      location="top right"
      max-width="min(360px, calc(100vw - 24px))"
    >
      <div class="d-flex align-center" style="gap: 10px;">
        <v-avatar size="36" color="grey-darken-3">
          <v-img v-if="latestFriendRequest?.senderAvatar" :src="latestFriendRequest.senderAvatar" />
          <v-icon v-else color="white" size="20">mdi-account-plus</v-icon>
        </v-avatar>
        <div>
          <p class="text-subtitle-2 font-weight-bold text-white mb-0">Lời mời kết bạn mới!</p>
          <p class="text-caption text-grey-lighten-2 mb-0">{{ latestFriendRequest?.senderName }} muốn kết bạn</p>
        </div>
      </div>
      <template #actions>
        <v-btn color="white" variant="text" size="small" class="text-none font-weight-bold" @click="goToZaloAccounts">
          Xem
        </v-btn>
      </template>
    </v-snackbar>

  </v-app>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { CUSTOMER_STATUS_LIST } from '@/modules/zalocrm/constants/customer-statuses';
import { useTheme, useDisplay } from 'vuetify';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';
import { useRouter, useRoute } from '@/modules/zalocrm/router-adapter';
import NotificationBell from '@/modules/zalocrm/components/NotificationBell.vue';
import { useZaloAccounts } from '@/modules/zalocrm/composables/use-zalo-accounts';
import { createSocket, integrationStorage } from '@/modules/zalocrm/integration';
import { api } from '@/modules/zalocrm/api/index';
import defaultLogo from '@/modules/zalocrm/assets/logo_only.png';
import portalLogo from '@/modules/zalocrm/assets/main_logo.png';

const appConfig = (window as any).APP_CONFIG || {};

const brandMenuOpen = ref(false);
const brandSwitchFormRef = ref<HTMLFormElement | null>(null);

const initialActiveBrandId = appConfig.activeBrandId;
const initialActiveBrandIds: number[] = Array.isArray(appConfig.activeBrandIds) && appConfig.activeBrandIds.length > 0
  ? appConfig.activeBrandIds
  : (initialActiveBrandId && initialActiveBrandId !== 'all' ? [Number(initialActiveBrandId)] : []);

const selectedBrandIds = ref<number[]>([...initialActiveBrandIds]);

const isAllBrandsSelected = computed(() => {
  return selectedBrandIds.value.length === 0 || selectedBrandIds.value.length === (appConfig.brands?.length || 0);
});

const isCustomBrandSelected = computed(() => {
  return !isAllBrandsSelected.value && selectedBrandIds.value.length > 0;
});

const brandDotClass = computed(() => {
  return isAllBrandsSelected.value ? 'brand-status-dot--purple' : 'brand-status-dot--emerald';
});

const brandButtonLabel = computed(() => {
  if (isAllBrandsSelected.value) {
    return 'Tất cả Brand';
  }
  if (selectedBrandIds.value.length === 1) {
    const found = appConfig.brands?.find((b: any) => b.id === selectedBrandIds.value[0]);
    return found?.name || '1 Brand';
  }
  return `${selectedBrandIds.value.length} Brand đã chọn`;
});

function selectAllBrands() {
  selectedBrandIds.value = [];
}

function selectAllBrandsAndSubmit() {
  selectedBrandIds.value = [];
  submitBrandSelection();
}

function toggleBrandItem(id: number) {
  const idx = selectedBrandIds.value.indexOf(id);
  if (idx === -1) {
    selectedBrandIds.value.push(id);
  } else {
    selectedBrandIds.value.splice(idx, 1);
  }
}

function submitBrandSelection() {
  if (!brandSwitchFormRef.value) return;
  const form = brandSwitchFormRef.value;
  const existingInputs = form.querySelectorAll('input[name="brand_ids[]"], input[name="brand_id"]');
  existingInputs.forEach(el => el.remove());

  if (isAllBrandsSelected.value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'brand_id';
    input.value = 'all';
    form.appendChild(input);
  } else {
    selectedBrandIds.value.forEach(id => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'brand_ids[]';
      input.value = String(id);
      form.appendChild(input);
    });
  }

  form.submit();
}
const theme = useTheme();
const { mobile } = useDisplay();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const isChatRoute = computed(() => {
  const p = route.path || '';
  return p === '/chat' ||
         p === '/cskh/chat' ||
         p.startsWith('/chat/') ||
         p.startsWith('/cskh/chat/') ||
         route.name === 'ZaloMessages' ||
         route.name === 'Chat';
});

function isMenuItemActive(item: MenuItem): boolean {
  if (item.path === '/chat?mode=unread' && isChatRoute.value && route.query.tab === 'unread') return true;
  if (item.path === '/warehouse') {
    return route.path === '/warehouse' || route.path === '/cskh/warehouse' || route.path === '/cskh/media' || route.path === '/cskh/catalog';
  }
  if (item.path.includes('?')) {
    const basePath = item.path.split('?')[0];
    const matchesBase = route.path === basePath || (basePath === '/chat' && isChatRoute.value);
    return matchesBase && [...new URLSearchParams(item.path.split('?')[1]).entries()].every(([key, value]) => route.query[key] === value);
  }
  if (item.path === '/chat') {
    return isChatRoute.value && !route.query.mode && !route.query.accountId && !route.query.category && !route.query.status && route.query.tab !== 'unread';
  }
  return route.path === item.path || (item.path === '/chat' && isChatRoute.value);
}

function navigateTo(path: string) {
  router.push(path);
  handleMenuClick();
}

const drawer = ref(typeof window !== 'undefined' ? window.innerWidth >= 1280 : true);
watch(mobile, (isMob) => {
  drawer.value = !isMob;
});
// Tự động thu gọn sidebar sau 3s khi không dùng đến
const rail = ref(false);
const accountMenuOpen = ref(false);
let collapseTimer: ReturnType<typeof setTimeout> | null = null;

function clearCollapseTimer() {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
}

function scheduleAutoCollapse(delayMs = 3000) {
  if (mobile.value) return;
  clearCollapseTimer();
  collapseTimer = setTimeout(() => {
    if (!mobile.value && !accountMenuOpen.value) {
      rail.value = true;
    }
    collapseTimer = null;
  }, delayMs);
}

watch(accountMenuOpen, (isOpen) => {
  if (isOpen) {
    clearCollapseTimer();
  } else {
    scheduleAutoCollapse(3000);
  }
});

function onSidebarMouseEnter() {
  if (mobile.value) return;
  rail.value = false;
  scheduleAutoCollapse(3000);
}

function onSidebarActivity() {
  if (mobile.value) return;
  if (!rail.value) {
    scheduleAutoCollapse(3000);
  }
}

function onSidebarMouseLeave() {
  if (mobile.value) return;
  scheduleAutoCollapse(3000);
}

function toggleSidebar() {
  if (mobile.value) {
    drawer.value = !drawer.value;
  } else {
    rail.value = !rail.value;
    if (rail.value) {
      clearCollapseTimer();
    } else {
      scheduleAutoCollapse(3000);
    }
  }
}


function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    const target = e.target as HTMLElement;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    e.preventDefault();
    toggleSidebar();
  }
}

const soundEnabled = ref(integrationStorage.getItem('crm-sound-enabled') !== 'false');

function toggleSound() {
  soundEnabled.value = !soundEnabled.value;
  integrationStorage.setItem('crm-sound-enabled', String(soundEnabled.value));
}

const notificationsSupported = ref('Notification' in window);
const notificationsEnabled = ref(
  'Notification' in window && Notification.permission === 'granted' && integrationStorage.getItem('crm-notifications-enabled') !== 'false'
);

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
 
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
 
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
  try {
    const registration = await navigator.serviceWorker.register('/zalo-sw.js', { scope: '/crm/' });
    await navigator.serviceWorker.ready;
    
    const keyRes = await api.get('/push/public-key');
    if (!keyRes.data.publicKey) {
      console.warn('VAPID public key is empty or not configured on backend.');
      return;
    }
    
    const applicationServerKey = urlBase64ToUint8Array(keyRes.data.publicKey);
    
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    
    const keyJson = subscription.toJSON();
    await api.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      p256dh: keyJson.keys?.p256dh,
      auth: keyJson.keys?.auth
    });
    
    console.log('[push] Push subscription registered successfully.');
  } catch (err) {
    console.error('[push] Failed to register push subscription:', err);
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      console.log('[push] Unsubscribed successfully.');
    }
  } catch (err) {
    console.error('[push] Failed to unsubscribe:', err);
  }
}

function toggleNotifications() {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    const val = integrationStorage.getItem('crm-notifications-enabled') !== 'false';
    const nextVal = !val;
    integrationStorage.setItem('crm-notifications-enabled', String(nextVal));
    notificationsEnabled.value = nextVal;
    
    if (nextVal) {
      subscribeToPush();
    } else {
      unsubscribeFromPush();
    }
  } else if (Notification.permission === 'denied') {
    alert('Bạn đã chặn thông báo trên trình duyệt. Vui lòng vào cài đặt trang web của trình duyệt để cho phép nhận thông báo.');
  } else {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        integrationStorage.setItem('crm-notifications-enabled', 'true');
        notificationsEnabled.value = true;
        subscribeToPush();
      } else {
        integrationStorage.setItem('crm-notifications-enabled', 'false');
        notificationsEnabled.value = false;
      }
    });
  }
}

function playLayoutNotificationSound() {
  if (integrationStorage.getItem('crm-sound-enabled') === 'false') return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    
    const now = ctx.currentTime;
    // Crisp double-chime: E5 (659.25Hz) then A5 (880.00Hz)
    playTone(659.25, now, 0.18);
    playTone(880.00, now + 0.08, 0.32);
    
    // Close context after tones are done to prevent resource leaks
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch (err) {
    console.warn('[sound] Playback failed:', err);
  }
}

function showLocalNotification(title: string, body: string, conversationId: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const options = {
    body: body,
    icon: defaultLogo,
    badge: defaultLogo,
    tag: 'zalo-crm-msg',
    renotify: true,
    data: {
      url: `/crm/cskh/chat?convId=${encodeURIComponent(conversationId)}`
    }
  };
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, options);
    }).catch(() => {
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        router.push(`/chat?convId=${conversationId}`);
        n.close();
      };
    });
  } else {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      router.push(`/chat?convId=${conversationId}`);
      n.close();
    };
  }
}


// Multi-theme reactive states (3 gam màu tối giản)
const currentTheme = ref(integrationStorage.getItem('crm-theme') || 'forestTheme');
if (['light-apple', 'emerald-care', 'dark-obsidian', 'dark-charcoal'].includes(currentTheme.value)) {
  currentTheme.value = 'forestTheme';
}
const isDark = ref(false);

const themeOptions = [
  { id: 'theme-monochrome', title: '1. Trắng đen tối giản', color: '#18181B' },
  { id: 'forestTheme', title: '2. Xanh thương hiệu', color: '#004526' },
  { id: 'corporate-navy', title: '3. Xanh Navy doanh nghiệp', color: '#1E3A8A' },
];

function resetToOriginalDefaults() {
  integrationStorage.removeItem('crm-custom-color');
  integrationStorage.setItem('crm-theme', 'forestTheme');
  currentTheme.value = 'forestTheme';
  
  clearCustomColorStyles();

  // Restore all presets to their default styles
  resetThemeDefaults('theme-monochrome');
  resetThemeDefaults('forestTheme');
  resetThemeDefaults('corporate-navy');
  
  // Apply theme
  theme.global.name.value = 'forestTheme';
  isDark.value = false;
  integrationStorage.setItem('theme', 'light');
  
  applyGradientVariables('forestTheme');
}

function clearCustomColorStyles() {
  if (typeof document === 'undefined') return;
  const styleEl = document.getElementById('custom-theme-styles');
  if (styleEl) {
    styleEl.remove();
  }
}

const defaultColors: Record<string, Record<string, string>> = {
  'forestTheme': {
    background: '#F5F8F6',
    surface: '#FFFFFF',
    'surface-variant': '#E8F1EC',
    'surface-light': '#DCE7E1',
    primary: '#004526',
    secondary: '#126B49',
    accent: '#004526',
  },
  'theme-monochrome': {
    background: '#F4F5F7',
    surface: '#FFFFFF',
    'surface-variant': '#E4E4E7',
    'surface-light': '#D4D4D8',
    primary: '#18181B',
    secondary: '#52525B',
    accent: '#18181B',
  },
  'corporate-navy': {
    background: '#F0F4F8',
    surface: '#FFFFFF',
    'surface-variant': '#E2E8F0',
    'surface-light': '#CBD5E1',
    primary: '#1E3A8A',
    secondary: '#0284C7',
    accent: '#2563EB',
  },
  'light-apple': {
    background: '#F5F8F6',
    surface: '#FFFFFF',
    'surface-variant': '#E8F1EC',
    'surface-light': '#DCE7E1',
    primary: '#004526',
    secondary: '#126B49',
    accent: '#004526',
  }
};

function resetThemeDefaults(themeName: string) {
  if (!theme.themes.value[themeName] || !defaultColors[themeName]) return;
  const colors = defaultColors[themeName];
  for (const [key, value] of Object.entries(colors)) {
    theme.themes.value[themeName].colors[key] = value;
  }
}

function applyGradientVariables(themeName: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--theme-gradient-1', 'transparent');
  root.style.setProperty('--theme-gradient-2', 'transparent');

  if (themeName === 'theme-monochrome') {
    root.style.setProperty('--sidebar-bg', '#18181B');
    root.style.setProperty('--sidebar-border', '#27272A');
    root.style.setProperty('--sidebar-active-bg', '#27272A');
    root.style.setProperty('--sidebar-group-header', '#71717A');
    root.style.setProperty('--sidebar-text', '#A1A1AA');
    root.style.setProperty('--sidebar-icon', '#71717A');
    root.style.setProperty('--sidebar-hover-bg', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--sidebar-hover-icon', '#FFFFFF');
    root.style.setProperty('--sidebar-dock-bg', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--sidebar-dock-border', '#27272A');
    root.style.setProperty('--sidebar-dock-icon', '#A1A1AA');
    root.style.setProperty('--sidebar-dock-active', '#FFFFFF');
    root.style.setProperty('--sidebar-dock-hover', '#FFFFFF');
    root.style.setProperty('--sidebar-dock-hover-bg', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--sidebar-badge-bg', '#3F3F46');
  } else if (themeName === 'corporate-navy') {
    root.style.setProperty('--sidebar-bg', '#0F172A');
    root.style.setProperty('--sidebar-border', '#1E293B');
    root.style.setProperty('--sidebar-active-bg', '#1E3A8A');
    root.style.setProperty('--sidebar-group-header', '#64748B');
    root.style.setProperty('--sidebar-text', '#94A3B8');
    root.style.setProperty('--sidebar-icon', '#64748B');
    root.style.setProperty('--sidebar-hover-bg', 'rgba(255, 255, 255, 0.10)');
    root.style.setProperty('--sidebar-hover-icon', '#38BDF8');
    root.style.setProperty('--sidebar-dock-bg', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--sidebar-dock-border', '#1E293B');
    root.style.setProperty('--sidebar-dock-icon', '#94A3B8');
    root.style.setProperty('--sidebar-dock-active', '#38BDF8');
    root.style.setProperty('--sidebar-dock-hover', '#38BDF8');
    root.style.setProperty('--sidebar-dock-hover-bg', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--sidebar-badge-bg', '#0284C7');
  } else {
    // forestTheme
    root.style.setProperty('--sidebar-bg', '#003B2B');
    root.style.setProperty('--sidebar-border', '#00261C');
    root.style.setProperty('--sidebar-active-bg', '#126B49');
    root.style.setProperty('--sidebar-group-header', '#5C8370');
    root.style.setProperty('--sidebar-text', '#9EBAAC');
    root.style.setProperty('--sidebar-icon', '#7CA291');
    root.style.setProperty('--sidebar-hover-bg', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--sidebar-hover-icon', '#34D399');
    root.style.setProperty('--sidebar-dock-bg', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--sidebar-dock-border', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--sidebar-dock-icon', '#9EBAAC');
    root.style.setProperty('--sidebar-dock-active', '#34D399');
    root.style.setProperty('--sidebar-dock-hover', '#34D399');
    root.style.setProperty('--sidebar-dock-hover-bg', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--sidebar-badge-bg', '#EF4444');
  }
}

function changeTheme(themeName: string) {
  currentTheme.value = themeName;
  integrationStorage.setItem('crm-theme', themeName);

  // Clear custom color since a preset is selected!
  integrationStorage.removeItem('crm-custom-color');

  clearCustomColorStyles();

  // Restore preset default colors in Vuetify
  resetThemeDefaults(themeName);

  // Apply theme name
  theme.global.name.value = themeName;

  // 3 themes đều là Light themes với sidebar sẫm màu thanh lịch
  isDark.value = false;
  integrationStorage.setItem('theme', 'light');

  applyGradientVariables(themeName);
}

const orgLogo = ref<string | null>(null);
const orgName = ref('CHUỖI CUNG ỨNG');

const { accounts, fetchAccounts, setupSocket } = useZaloAccounts();
const unreadCount = ref(0);
const systemExpanded = ref(false);
const overviewExpanded = ref(true);
const statusExpanded = ref(true);
const pendingNeedsCount = ref(0);

async function fetchNeedsCount() {
  try {
    const config = (window as any).APP_CONFIG;
    const response = await fetch('/api/customer-needs?page=1', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-CSRF-TOKEN': config?.csrfToken || '',
      },
    });
    if (response.ok) {
      const data = await response.json();
      pendingNeedsCount.value = Number(data.counts?.pending || 0);
    }
  } catch (err) {
    console.error('Failed to fetch pending customer needs count:', err);
  }
}

const sidebarAccountId = computed(() => typeof route.query.accountId === 'string' ? route.query.accountId : null);
const currentActiveAccount = computed(() => accounts.value.find(a => a.id === sidebarAccountId.value) || null);
function selectSidebarAccount(accountId: string | null) {
  const { accountId: _account, convId: _conv, action: _action, ...query } = isChatRoute.value ? route.query : {};
  router.push({ path: '/chat', query: accountId ? { ...query, accountId } : query });
  handleMenuClick();
}
function menuBadge(item: MenuItem) {
  if (item.badge === 'needs') return pendingNeedsCount.value;
  return item.badge === 'unread' ? unreadCount.value : item.badge === 'tracked' ? trackedCount.value : 0;
}
const taskCount = ref(0);
const trackedCount = ref(0);
let globalSocket: any = null;

const disconnectedAccounts = computed(() => {
  return accounts.value.filter(acc => (acc.liveStatus || acc.status) !== 'connected');
});

function updateFavicon(logoUrl: string | null) {
  if (typeof document === 'undefined') return;
  
  // Standard icon
  let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = logoUrl || defaultLogo;
}

async function fetchOrgInfo() {
  try {
    const res = await api.get('/organization');
    orgName.value = 'CHUỖI CUNG ỨNG';
    orgLogo.value = res.data.logo || null;
    if (typeof document !== 'undefined') {
      document.title = 'CHUỖI CUNG ỨNG · CSKH Omnichannel';
      if (orgLogo.value) {
        updateFavicon(orgLogo.value);
      }
    }
  } catch (err) {
    console.error('Failed to fetch organization details:', err);
  }
}

async function fetchTaskCount() {
  if (authStore.user?.role === 'accountant') return;
  try {
    const [res, unread] = await Promise.all([api.get('/conversations/uncompleted'), api.get('/conversations', { params: { unreadOnly: 'true', limit: 1 } })]);
    unreadCount.value = unread.data.total || 0;
    taskCount.value = res.data.conversations?.length || 0;
    trackedCount.value = res.data.trackedCount || 0;
    
    // Save to localStorage for instant sync with native portal sidebar
    try {
      localStorage.setItem('zalo_unread_count', String(unreadCount.value));
    } catch(e) {}

    // Update PWA App Icon Badge count in real-time
    if ('setAppBadge' in navigator) {
      const totalBadge = unreadCount.value;
      if (totalBadge > 0) {
        (navigator as any).setAppBadge(totalBadge).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }

    // Update browser document title with unread customer message count
    if (typeof document !== 'undefined') {
      const baseTitle = orgName.value || 'Zalo & WhatsApp CRM';
      const cleanTitle = baseTitle.replace(/^\(\d+\)\s*/, '');
      document.title = unreadCount.value > 0 ? `(${unreadCount.value}) ${cleanTitle}` : cleanTitle;
    }
  } catch (err) {
    console.error('Failed to fetch task count:', err);
    taskCount.value = 0;
    trackedCount.value = 0;
  }
}

function handleMenuClick() {
  if (mobile.value) {
    drawer.value = false;
  } else {
    scheduleAutoCollapse(3000);
  }
}

let taskCountDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let globalSocketHandlers: Array<[string, (...args: any[]) => void]> = [];

function registerGlobalSocketHandler(event: string, handler: (...args: any[]) => void) {
  if (!globalSocket) return;
  globalSocket.on(event, handler);
  globalSocketHandlers.push([event, handler]);
}

onMounted(() => {
  // Sync initial theme
  theme.global.name.value = currentTheme.value;
  
  // Clear any residual custom color stylesheet if not using custom color anymore
  clearCustomColorStyles();
  
  applyGradientVariables(currentTheme.value);
  
  fetchOrgInfo();
  fetchAccounts();
  setupSocket();
  fetchTaskCount();
  fetchNeedsCount();
  scheduleAutoCollapse(3000);

  let lastLayoutSoundTime = 0;

  globalSocket = createSocket();
  registerGlobalSocketHandler('chat:message', (data: any) => {
    if (taskCountDebounceTimer) clearTimeout(taskCountDebounceTimer);
    taskCountDebounceTimer = setTimeout(() => {
      fetchTaskCount();
      fetchNeedsCount();
    }, 400);
    
    // Ignore historical catch-up sync messages from triggering sounds/notifications
    if (data?.isCatchUp) {
      return;
    }

    if (data && data.message && data.message.senderType !== 'self') {
      const onChatPage = isChatRoute.value;
      const activeConvId = integrationStorage.getItem('crm-active-conv-id');
      const isViewingActiveConv = onChatPage && (activeConvId === data.conversationId);
      
      // Play sound for incoming customer messages when sound enabled
      if (soundEnabled.value) {
        const now = Date.now();
        if (now - lastLayoutSoundTime > 1200) {
          lastLayoutSoundTime = now;
          playLayoutNotificationSound();
        }
      }
      
      if (document.hidden || !isViewingActiveConv) {
        if (notificationsEnabled.value && integrationStorage.getItem('crm-notifications-enabled') !== 'false') {
          const isWhatsApp = data.channel === 'whatsapp' || data.message?.channel === 'whatsapp' || String(data.message?.senderUid || '').includes('@s.whatsapp.net') || String(data.message?.senderUid || '').includes('@g.us');
          const prefix = isWhatsApp ? '🟢 [WhatsApp] ' : '🔵 [Zalo] ';
          const title = prefix + (data.message.senderName || 'Tin nhắn mới');
          let body = '';
          if (data.message.contentType === 'text') {
            body = data.message.content || '';
          } else {
            const typeMap: Record<string, string> = {
              image: '📷 Hình ảnh',
              sticker: '🏷️ Sticker',
              video: '🎥 Video',
              voice: '🎤 Tin nhắn thoại',
              file: '📎 Tệp đính kèm',
              link: '🔗 Liên kết',
            };
            body = typeMap[data.message.contentType] || '[Tin nhắn mới]';
          }
          showLocalNotification(title, body, data.conversationId);
        }
      }
    }
  });
  registerGlobalSocketHandler('zalo:friend_request', (data: any) => {
    latestFriendRequest.value = data;
    showFriendRequestToast.value = true;
    // Play notification sound
    if (soundEnabled.value) playLayoutNotificationSound();
  });

  window.addEventListener('crm:accounts-changed', fetchAccounts);
  window.addEventListener('crm:unread-changed', fetchTaskCount);
  window.addEventListener('crm:needs-changed', fetchNeedsCount);
  registerGlobalSocketHandler('conversation:quote-update', () => {
    fetchTaskCount();
    fetchNeedsCount();
  });
  registerGlobalSocketHandler('org:update', () => {
    fetchOrgInfo();
  });

  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  theme.global.name.value = 'forestTheme';
  document.title = 'CHUỖI CUNG ỨNG CRM — Forest Adaptive';
  document.documentElement.style.removeProperty('--theme-gradient-1');
  document.documentElement.style.removeProperty('--theme-gradient-2');
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
  if (taskCountDebounceTimer) {
    clearTimeout(taskCountDebounceTimer);
    taskCountDebounceTimer = null;
  }
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('crm:accounts-changed', fetchAccounts);
  window.removeEventListener('crm:unread-changed', fetchTaskCount);
  window.removeEventListener('crm:needs-changed', fetchNeedsCount);
  if (globalSocket) {
    for (const [event, handler] of globalSocketHandlers) {
      globalSocket.off(event, handler);
    }
    globalSocketHandlers = [];
    globalSocket = null;
  }
});

interface MenuItem {
  title: string;
  icon: string;
  path: string;
  badge?: 'unread' | 'tracked' | 'needs';
  adminOnly?: boolean;
  allowedForAccountant?: boolean;
  categoryColor?: string;
  color?: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const userAvatarUrl = computed(() => {
  return (authStore.user as any)?.avatarUrl || accounts.value[0]?.avatarUrl || '';
});

const menuGroups: MenuGroup[] = [
  {
    title: 'Tổng quan',
    items: [
      { title: 'Dashboard', icon: 'mdi-view-dashboard-variant-outline', path: '/dashboard', color: '#34D399', allowedForAccountant: true },
      { title: 'Báo cáo', icon: 'mdi-chart-line', path: '/reports', color: '#60A5FA', allowedForAccountant: true },
    ],
  },
  {
    title: 'Kinh doanh & CSKH',
    items: [
      { title: 'Tất cả hội thoại', icon: 'mdi-forum-outline', path: '/chat', badge: 'unread' as const, color: '#4ADE80', allowedForAccountant: true },
      { title: 'Nhu cầu từ Sales', icon: 'mdi-clipboard-text-outline', path: '/needs', badge: 'needs' as const, color: '#22D3EE', allowedForAccountant: true },
      { title: 'Danh bạ KH', icon: 'mdi-contacts-outline', path: '/contacts', color: '#FB7185', allowedForAccountant: true },
    ],
  },
  {
    title: 'Trạng thái',
    items: CUSTOMER_STATUS_LIST.map(status => ({
      title: status.label,
      icon: status.icon,
      path: '/chat?status=' + encodeURIComponent(status.id),
      categoryColor: status.color,
      allowedForAccountant: true,
    })),
  },
  {
    title: 'Hệ thống',
    items: [
      { title: 'Tài khoản Zalo', icon: 'mdi-cellphone-link', path: '/zalo-accounts', color: '#38BDF8', adminOnly: true },
      { title: 'Trợ lý AI', icon: 'mdi-creation', path: '/ai', color: '#C084FC', adminOnly: true },
      { title: 'API & Webhook', icon: 'mdi-webhook', path: '/api-settings', color: '#FB923C', adminOnly: true, allowedForAccountant: false },
    ],
  },
];

const filteredMenuGroups = computed(() => {
  return menuGroups
    .map((group) => {
      const items = group.items.filter((item) => {
        if (item.adminOnly && !authStore.isAdmin) return false;
        if (authStore.user?.role === 'accountant' && !item.allowedForAccountant) return false;
        return true;
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
});

function logout() {
  authStore.logout();

}

// ── Friend Request Toast Notification ────────────────────────────────────────
const showFriendRequestToast = ref(false);
const latestFriendRequest = ref<any>(null);

function goToZaloAccounts() {
  showFriendRequestToast.value = false;
  router.push('/zalo-accounts');
}

</script>

<style scoped>
.crm-topbar {
  background: #FFFFFF !important;
  border-bottom: 1px solid #E5EBE7 !important;
  box-shadow: none !important;
}
.workspace-role-label {
  font-size: 11px;
  font-weight: 600;
  color: #003B2B;
  background: #F5F8F6;
  border: 1px solid #E5EBE7;
  border-radius: 12px;
  padding: 4px 10px;
  white-space: nowrap;
  margin: 0 10px;
}
/* Brand switcher pill button */
.workspace-brand-container {
  display: inline-flex;
  align-items: center;
  margin: 0 8px;
}

.workspace-brand-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #FFFFFF;
  border: 1px solid #D0DDD5;
  border-radius: 9999px;
  padding: 5px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #003B2B;
  cursor: pointer;
  outline: none;
  transition: all 0.18s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.workspace-brand-btn:hover {
  background: #F0FDF4;
  border-color: #004526;
  box-shadow: 0 2px 4px rgba(0, 69, 38, 0.08);
}

.workspace-brand-btn--active {
  background: #F0FDF4;
  border-color: #10B981;
  color: #004526;
}

.brand-btn-text {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.brand-status-dot--purple {
  background-color: #A855F7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
}

.brand-status-dot--emerald {
  background-color: #10B981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.brand-chevron {
  color: #64748B;
  transition: transform 0.2s ease;
}

.brand-chevron--rotated {
  transform: rotate(180deg);
}

/* Brand dropdown card */
.brand-dropdown-card {
  background: #FFFFFF !important;
  border: 1px solid #E5EBE7 !important;
  border-radius: 14px !important;
  box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06) !important;
  padding: 8px !important;
  user-select: none;
}

.brand-dropdown-header {
  padding: 4px 10px 8px;
}

.brand-dropdown-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: #94A3B8;
  text-transform: uppercase;
}

.brand-dropdown-divider {
  height: 1px;
  background: #F1F5F9;
  margin: 6px 0;
}

.brand-items-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #334155;
  font-size: 12.5px;
}

.brand-select-item:hover {
  background: #F8FAFC;
}

.brand-select-item--active {
  background: #E2F0E7 !important;
  color: #004526 !important;
  font-weight: 600;
}

.brand-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-custom-checkbox {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1.5px solid #CBD5E1;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.brand-custom-checkbox--checked {
  background: #10B981 !important;
  border-color: #10B981 !important;
}

.brand-item-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.brand-item-dot--purple {
  background-color: #A855F7;
}

.brand-item-dot--emerald {
  background-color: #10B981;
}

.brand-item-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-badge-default {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  color: #004526;
  background: #D1FAE5;
  padding: 2px 6px;
  border-radius: 4px;
}

.brand-dropdown-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #F1F5F9;
}

.btn-reset-all {
  background: transparent;
  border: none;
  color: #64748B;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.btn-reset-all:hover {
  color: #004526;
  background: #F1F5F9;
}

.btn-apply-brands {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #004526;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 69, 38, 0.2);
}

.btn-apply-brands:hover {
  background: #00351d;
  box-shadow: 0 2px 6px rgba(0, 69, 38, 0.3);
}

.apply-count-pill {
  background: rgba(255, 255, 255, 0.25);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
}
.crm-topbar .btn-accountant-link {
  background: #E8F8EE !important;
  color: #004526 !important;
  border: 1px solid #C5E1CF !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  padding: 0 12px !important;
  height: 32px !important;
  margin-right: 6px;
}
.crm-topbar .btn-accountant-link:hover {
  background: #D5F0DE !important;
}
.crm-topbar .btn-portal-back {
  border: 1px solid #D0DDD5 !important;
  background: #F5F8F6 !important;
  color: #003B2B !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  padding: 0 12px !important;
  height: 32px !important;
}
.crm-topbar .btn-portal-back:hover {
  background: #EAF1ED !important;
  border-color: #004526 !important;
}
.crm-disconnected-text {
  min-width: 0;
  max-width: calc(100vw - 140px);
}
@media(max-width:900px){
  .workspace-role-label { display: none; }
  .workspace-brand select { max-width: 110px; }
}
@media(max-width:599px){
  .workspace-brand-container {
    margin: 0 4px;
  }
  .workspace-brand-btn {
    padding: 4px 8px;
    font-size: 11px;
    gap: 5px;
  }
  .brand-btn-text {
    max-width: 78px;
  }
  .crm-topbar .btn-accountant-link,
  .crm-topbar .btn-portal-back {
    padding: 0 8px !important;
    height: 30px !important;
    font-size: 11px !important;
    border-radius: 10px !important;
    margin-right: 4px;
    min-width: 0 !important;
  }
  .crm-topbar .btn-portal-back {
    margin-right: 6px;
  }
}
@media(max-width:374px){
  .btn-accountant-text {
    display: none;
  }
  .brand-btn-text {
    max-width: 58px;
  }
}

/* ── 1. FOREST BRAND THEME (Mặc định - Chuỗi Cung Ứng) ── */
.theme-topbar--forestTheme .brand-title-prefix { color: #003B2B; }
.theme-topbar--forestTheme .brand-title-suffix { color: #004526; }
.theme-topbar--forestTheme .workspace-role-label { color: #003B2B; background: #F5F8F6; border: 1px solid #E5EBE7; }
.theme-topbar--forestTheme .btn-accountant-link { background: #E8F8EE !important; color: #004526 !important; border: 1px solid #C5E1CF !important; }

.custom-app-sidebar.theme-sidebar--forestTheme {
  background: #003B2B !important;
  border-right: 1px solid #00261C !important;
  color: #FFFFFF !important;
}
.custom-app-sidebar {
  background: var(--sidebar-bg, #003B2B) !important;
  border-right: 1px solid var(--sidebar-border, #00261C) !important;
  color: #FFFFFF !important;
}
.theme-sidebar--forestTheme .menu-group-header,
.custom-app-sidebar .menu-group-header { color: #6EE7B7 !important; font-weight: 700; font-size: 0.72rem; letter-spacing: 0.7px; }
.theme-sidebar--forestTheme .sidebar-navigation :deep(.v-list-item) { color: #FFFFFF !important; font-weight: 600 !important; }
.theme-sidebar--forestTheme .sidebar-navigation :deep(.v-list-item-title) { color: #FFFFFF !important; font-weight: 600 !important; }
.theme-sidebar--forestTheme .sidebar-navigation :deep(.v-list-item:hover) {
  background: rgba(255, 255, 255, 0.16) !important;
  color: #FFFFFF !important;
  transform: translateX(2px);
  box-shadow: inset 0 0 0 1px rgba(110, 231, 183, 0.3), 0 2px 6px rgba(0, 0, 0, 0.16) !important;
}
.theme-sidebar--forestTheme .sidebar-navigation :deep(.v-list-item:hover .v-icon) { filter: brightness(1.2); }
.theme-sidebar--forestTheme .sidebar-navigation :deep(.v-list-item--active) {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important;
  color: #FFFFFF !important;
  font-weight: 700 !important;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35) !important;
}
.theme-sidebar--forestTheme .account-list :deep(.v-list-item:hover) {
  background: rgba(255, 255, 255, 0.14) !important;
  color: #FFFFFF !important;
  transform: translateX(2px);
  box-shadow: inset 0 0 0 1px rgba(110, 231, 183, 0.25) !important;
}
.theme-sidebar--forestTheme .account-list :deep(.v-list-item--active) {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important;
  color: #FFFFFF !important;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35) !important;
}
.theme-sidebar--forestTheme .system-group-toggle:hover {
  background: rgba(255, 255, 255, 0.10) !important;
  color: #FFFFFF !important;
}
.theme-sidebar--forestTheme .system-quick-dock .v-btn:hover {
  color: #34D399 !important;
  background: rgba(255, 255, 255, 0.12) !important;
}

/* ── 2. MONOCHROME MINIMALIST THEME (Trắng đen tối giản) ── */
.theme-topbar--theme-monochrome .brand-title-prefix { color: #18181B; }
.theme-topbar--theme-monochrome .brand-title-suffix { color: #71717A; }
.theme-topbar--theme-monochrome .workspace-role-label { color: #18181B; background: #F4F4F5; border: 1px solid #E4E4E7; }
.theme-topbar--theme-monochrome .btn-accountant-link { background: #F4F4F5 !important; color: #18181B !important; border: 1px solid #E4E4E7 !important; }
.theme-topbar--theme-monochrome .workspace-brand select:hover,
.theme-topbar--theme-monochrome .btn-portal-back:hover { border-color: #18181B !important; color: #18181B !important; }

.custom-app-sidebar.theme-sidebar--theme-monochrome {
  background: #18181B !important;
  border-right: 1px solid #27272A !important;
  color: #FFFFFF !important;
}
.theme-sidebar--theme-monochrome .connections-heading { border-bottom-color: #27272A !important; }
.theme-sidebar--theme-monochrome .menu-group-header { color: #71717A !important; }
.theme-sidebar--theme-monochrome .sidebar-navigation :deep(.v-list-item) { color: #A1A1AA !important; }
.theme-sidebar--theme-monochrome .sidebar-navigation :deep(.v-list-item .v-icon) { color: #71717A !important; }
.theme-sidebar--theme-monochrome .sidebar-navigation :deep(.v-list-item:hover) {
  background: rgba(255, 255, 255, 0.14) !important;
  color: #FFFFFF !important;
  transform: translateX(3px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22), 0 2px 6px rgba(0, 0, 0, 0.25) !important;
}
.theme-sidebar--theme-monochrome .sidebar-navigation :deep(.v-list-item:hover .v-icon) { color: #FFFFFF !important; }
.theme-sidebar--theme-monochrome .sidebar-navigation :deep(.v-list-item--active) {
  background: #27272A !important;
  color: #FFFFFF !important;
  box-shadow: inset 0 0 0 1px #3F3F46 !important;
}
.theme-sidebar--theme-monochrome .account-list :deep(.v-list-item:hover) {
  background: rgba(255, 255, 255, 0.14) !important;
  color: #FFFFFF !important;
  transform: translateX(3px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22) !important;
}
.theme-sidebar--theme-monochrome .account-list :deep(.v-list-item--active) {
  background: #27272A !important;
  color: #FFFFFF !important;
}
.theme-sidebar--theme-monochrome .system-group-toggle { color: #71717A !important; }
.theme-sidebar--theme-monochrome .system-group-toggle:hover { background: rgba(255, 255, 255, 0.12) !important; color: #FFFFFF !important; }
.theme-sidebar--theme-monochrome .system-user-box { border-color: #27272A !important; }
.theme-sidebar--theme-monochrome .system-quick-dock .v-btn:hover { color: #FFFFFF !important; background: rgba(255, 255, 255, 0.14) !important; }

/* ── 3. CORPORATE DEEP NAVY THEME (Xanh Navy doanh nghiệp) ── */
.theme-topbar--corporate-navy .brand-title-prefix { color: #0F172A; }
.theme-topbar--corporate-navy .brand-title-suffix { color: #0284C7; }
.theme-topbar--corporate-navy .workspace-role-label { color: #1E3A8A; background: #F0F4F8; border: 1px solid #CBD5E1; }
.theme-topbar--corporate-navy .btn-accountant-link { background: #E0F2FE !important; color: #0284C7 !important; border: 1px solid #BAE6FD !important; }
.theme-topbar--corporate-navy .workspace-brand select:hover,
.theme-topbar--corporate-navy .btn-portal-back:hover { border-color: #0284C7 !important; color: #0284C7 !important; }

.custom-app-sidebar.theme-sidebar--corporate-navy {
  background: #0F172A !important;
  border-right: 1px solid #1E293B !important;
  color: #FFFFFF !important;
}
.theme-sidebar--corporate-navy .connections-heading { border-bottom-color: #1E293B !important; }
.theme-sidebar--corporate-navy .menu-group-header { color: #64748B !important; }
.theme-sidebar--corporate-navy .sidebar-navigation :deep(.v-list-item) { color: #94A3B8 !important; }
.theme-sidebar--corporate-navy .sidebar-navigation :deep(.v-list-item .v-icon) { color: #64748B !important; }
.theme-sidebar--corporate-navy .sidebar-navigation :deep(.v-list-item:hover) {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #FFFFFF !important;
  transform: translateX(3px);
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.25), 0 2px 6px rgba(0, 0, 0, 0.25) !important;
}
.theme-sidebar--corporate-navy .sidebar-navigation :deep(.v-list-item:hover .v-icon) { color: #38BDF8 !important; }
.theme-sidebar--corporate-navy .sidebar-navigation :deep(.v-list-item--active) {
  background: #1E3A8A !important;
  color: #FFFFFF !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
}
.theme-sidebar--corporate-navy .account-list :deep(.v-list-item:hover) {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #FFFFFF !important;
  transform: translateX(3px);
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.25) !important;
}
.theme-sidebar--corporate-navy .account-list :deep(.v-list-item--active) {
  background: #1E3A8A !important;
  color: #FFFFFF !important;
}
.theme-sidebar--corporate-navy .system-group-toggle { color: #64748B !important; }
.theme-sidebar--corporate-navy .system-group-toggle:hover { background: rgba(255, 255, 255, 0.12) !important; color: #FFFFFF !important; }
.theme-sidebar--corporate-navy .system-user-box { border-color: #1E293B !important; }
.theme-sidebar--corporate-navy .system-quick-dock .v-btn:hover { color: #38BDF8 !important; background: rgba(255, 255, 255, 0.12) !important; }

/* ── Common Sidebar Base Elements ── */
.custom-app-sidebar .connections-heading {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.custom-app-sidebar .connection-total {
  background: rgba(255, 255, 255, 0.1);
  color: #9EBAAC;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.custom-app-sidebar .account-list :deep(.v-list-item) {
  border-radius: 8px !important;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.custom-app-sidebar .sidebar-navigation :deep(.v-list-item) {
  border-radius: 9px !important;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.custom-app-sidebar .nav-count--needs {
  background: #10B981 !important;
  color: #FFFFFF !important;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(16, 185, 129, 0.4);
}
.custom-app-sidebar .system-user-box {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #FFFFFF !important;
  transition: all 0.18s ease;
}
.custom-app-sidebar .system-user-box .user-role-label {
  color: #FFFFFF !important;
  opacity: 0.9 !important;
}
.custom-app-sidebar .system-user-box:hover {
  background: rgba(255, 255, 255, 0.09) !important;
}
.custom-app-sidebar .system-quick-dock {
  background: var(--sidebar-dock-bg, rgba(255, 255, 255, 0.04)) !important;
  border: 1px solid var(--sidebar-dock-border, rgba(255, 255, 255, 0.08)) !important;
}
.custom-app-sidebar .system-quick-dock .v-btn {
  color: var(--sidebar-dock-icon, #9EBAAC) !important;
  transition: all 0.18s ease;
}
.custom-app-sidebar .system-quick-dock .v-btn .v-icon:not(.dock-icon--active) {
  color: inherit !important;
}
.custom-app-sidebar .system-quick-dock .v-btn:hover {
  color: var(--sidebar-dock-hover, #34D399) !important;
  background: var(--sidebar-dock-hover-bg, rgba(255, 255, 255, 0.12)) !important;
}
.custom-app-sidebar .system-quick-dock .v-btn:hover .v-icon:not(.dock-icon--active) {
  color: inherit !important;
}
.custom-app-sidebar .system-quick-dock .dock-icon--active {
  color: var(--sidebar-dock-active, #34D399) !important;
}
.custom-app-sidebar .system-quick-dock .dock-btn--logout {
  color: var(--sidebar-dock-icon, #9EBAAC) !important;
  opacity: 0.85;
}
.custom-app-sidebar .system-quick-dock .dock-btn--logout:hover {
  color: #EF4444 !important;
  background: rgba(239, 68, 68, 0.15) !important;
  opacity: 1;
}
.custom-app-sidebar .system-quick-dock .dock-btn--logout:hover .v-icon {
  color: #EF4444 !important;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-pulse {
  animation: pulse 1.5s infinite;
  display: inline-block;
}
.pulse-menu-red {
  color: #ff5252 !important;
}
.pulse-menu-orange {
  color: #ff9800 !important;
}

/* ── evondevKit Sidebar Optimizations ── */
.menu-group-header {
  letter-spacing: 0.08em;
  font-size: 0.68rem !important;
  color: rgba(var(--v-theme-on-surface), 0.55);
  user-select: none;
}
.rail-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  position: absolute;
  top: 9px;
  right: 12px;
  box-shadow: 0 0 6px currentColor;
}
.custom-nav-tooltip {
  font-weight: 600 !important;
  font-size: 0.78rem !important;
  letter-spacing: 0.2px !important;
  padding: 6px 12px !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3) !important;
}
.nav-item {
  transition: all 0.18s ease-in-out;
}
.nav-collapse-btn {
  transition: all 0.2s ease;
  opacity: 0.85;
}
.nav-collapse-btn:hover {
  opacity: 1;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.sidebar-footer-section {
  border-color: rgba(var(--v-theme-on-surface), 0.08) !important;
}
.account-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 9px;
  object-fit: cover;
  display: block;
}
.user-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

/* Sidebar compact optimizations: remove wide spacer & shift text close to icon */
.custom-app-sidebar :deep(.v-list-item__spacer),
.sidebar-navigation :deep(.v-list-item__spacer) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  margin: 0 !important;
}

/* Di chuyển text qua phải một chút và căn đều cân đối 2 bên (Image 2) */
.sidebar-navigation :deep(.v-list-item__prepend) {
  margin-inline-end: 14px !important;
}
.sidebar-navigation :deep(.v-list-item__prepend > .v-icon) {
  margin: 0 !important;
}
.sidebar-navigation :deep(.v-list-item) {
  padding-inline-start: 14px !important;
  padding-inline-end: 12px !important;
  padding-block: 4px !important;
  min-height: 38px !important;
  margin-bottom: 3px !important;
  border-radius: 9px !important;
}
.sidebar-navigation :deep(.v-list-item-title) {
  font-size: 0.855rem !important;
  letter-spacing: -0.1px !important;
  white-space: nowrap !important;
  padding-left: 2px !important;
}

.custom-app-sidebar .connections-heading {
  padding: 6px 12px 4px 12px !important;
  min-height: 30px !important;
}
.custom-app-sidebar .connected-accounts {
  padding-bottom: 4px !important;
}
.custom-app-sidebar .account-list :deep(.v-list-item) {
  padding-inline: 10px !important;
  min-height: 36px !important;
}
.custom-app-sidebar .system-group-toggle {
  padding: 6px 12px !important;
  min-height: 32px !important;
  border-radius: 8px !important;
}

/* ── Rail Mode: Kích thước cân đối, gom tài khoản & menu lại 1 chỗ gọn gàng ── */
.v-navigation-drawer--rail .connected-accounts {
  padding-bottom: 4px !important;
  margin-bottom: 4px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
}
.v-navigation-drawer--rail .connections-heading--rail {
  padding: 6px 0 4px !important;
  min-height: 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  border-bottom: none !important;
}
.v-navigation-drawer--rail .account-list {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
}
.v-navigation-drawer--rail .account-list :deep(.v-list-item) {
  width: 42px !important;
  min-height: 42px !important;
  height: 42px !important;
  margin: 0 auto 5px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 12px !important;
}
.v-navigation-drawer--rail .account-list :deep(.v-list-item__prepend) {
  margin-inline-end: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.v-navigation-drawer--rail .account-avatar {
  margin-right: 0 !important;
}
.account-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 700;
  font-size: 13px;
  transition: all 0.2s ease;
}
.account-avatar--whatsapp {
  background: #25D366 !important;
  border-color: #20BA5C !important;
  color: #FFFFFF !important;
  box-shadow: 0 2px 6px rgba(37, 211, 102, 0.35) !important;
}
.account-avatar-wa-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.v-navigation-drawer--rail .sidebar-navigation {
  padding-top: 4px !important;
  padding-bottom: 8px !important;
  padding-inline: 4px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
}
.v-navigation-drawer--rail .sidebar-navigation div.mb-2 {
  margin-bottom: 2px !important;
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
}
.v-navigation-drawer--rail .sidebar-navigation :deep(.v-list-item) {
  width: 42px !important;
  min-height: 42px !important;
  height: 42px !important;
  margin: 0 auto 4px !important;
  padding-inline: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 12px !important;
}
.v-navigation-drawer--rail .sidebar-navigation :deep(.v-list-item__prepend) {
  margin-inline-end: 0 !important;
}
.v-navigation-drawer--rail .sidebar-navigation :deep(.v-list-item__prepend > .v-icon) {
  font-size: 21px !important;
}
.v-navigation-drawer--rail .system-group-toggle {
  width: 42px !important;
  min-height: 38px !important;
  height: 38px !important;
  margin: 0 auto 4px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 10px !important;
}
.v-navigation-drawer--rail .v-divider {
  margin-block: 4px !important;
  margin-inline: auto !important;
  width: 36px !important;
}
.custom-app-sidebar :deep(.v-navigation-drawer__content) {
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-primary), 0.2) transparent;
}
.custom-app-sidebar :deep(.v-navigation-drawer__content::-webkit-scrollbar) {
  width: 4px;
}
.custom-app-sidebar :deep(.v-navigation-drawer__content::-webkit-scrollbar-thumb) {
  background: rgba(var(--v-theme-primary), 0.2);
  border-radius: 4px;
}
.crm-content--chat {
  padding: 0 !important;
  height: calc(100dvh - var(--v-layout-top, 64px)) !important;
  max-height: calc(100dvh - var(--v-layout-top, 64px)) !important;
  overflow: hidden !important;
}

/* ── Consolidated Accounts Styles (Dồn tài khoản thành 1) ── */
.consolidated-account-rail {
  position: relative;
  width: 44px;
  height: 44px;
  margin: 6px auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  transition: all 0.2s ease;
}
.consolidated-account-rail:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(52, 211, 153, 0.6);
  transform: scale(1.05);
}
.consolidated-account-rail--active {
  background: rgba(16, 185, 129, 0.25);
  border-color: #34D399;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.3);
}
.rail-account-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #10B981;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #003B2B;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.consolidated-account-expanded {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 4px 10px 10px 10px;
}
.consolidated-account-expanded:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(52, 211, 153, 0.4);
}
.consolidated-account-expanded--active {
  background: rgba(16, 185, 129, 0.2);
  border-color: #34D399;
}
.account-avatar-composite {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(0, 59, 43, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(52, 211, 153, 0.4);
}
.crm-account-menu {
  background: #FFFFFF !important;
  border: 1px solid #E5EBE7 !important;
  color: #132A23 !important;
}

/* Tinh chỉnh active icon trong Rail mode: Không còn khối xanh chói mắt (AI Flop) */
.v-navigation-drawer--rail .sidebar-navigation :deep(.v-list-item--active) {
  background: rgba(16, 185, 129, 0.22) !important;
  border: 1.5px solid rgba(52, 211, 153, 0.5) !important;
  border-radius: 12px !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25) !important;
}
.v-navigation-drawer--rail .sidebar-navigation :deep(.v-list-item--active .v-icon) {
  color: #34D399 !important;
}
</style>
