<template>
  <div class="warehouse-view">
    <!-- Top Segmented Bar -->
    <div class="warehouse-top-bar px-4 px-md-6 pt-4 pb-2">
      <div class="d-flex flex-wrap align-center justify-space-between" style="gap: 16px;">
        <div>
          <div class="d-flex align-center" style="gap: 10px;">
            <div class="warehouse-icon-badge">
              <v-icon color="primary" size="24">mdi-package-variant-closed</v-icon>
            </div>
            <div>
              <h1 class="text-h6 font-weight-bold mb-0" style="letter-spacing: -0.2px;">Kho & Tư vấn sản phẩm</h1>
              <span class="text-caption text-medium-emphasis">Tập hợp hình ảnh mẫu và danh mục Catalog tư vấn Zalo</span>
            </div>
          </div>
        </div>

        <!-- Segmented Tab Switcher -->
        <div class="warehouse-segmented-tabs" role="tablist" aria-label="Chuyển đổi kho">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'media'"
            class="warehouse-tab-btn"
            :class="{ 'is-active': activeTab === 'media' }"
            @click="setTab('media')"
          >
            <v-icon size="17" class="mr-1.5">mdi-image-multiple-outline</v-icon>
            Kho hình ảnh
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'catalog'"
            class="warehouse-tab-btn"
            :class="{ 'is-active': activeTab === 'catalog' }"
            @click="setTab('catalog')"
          >
            <v-icon size="17" class="mr-1.5">mdi-book-open-page-variant-outline</v-icon>
            Catalog sản phẩm
          </button>
        </div>
      </div>
    </div>

    <v-divider class="my-1 opacity-20" />

    <!-- Tab View Content -->
    <div class="warehouse-content">
      <keep-alive>
        <MediaView v-if="activeTab === 'media'" key="media" />
        <CatalogView v-else key="catalog" />
      </keep-alive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MediaView from './MediaView.vue';
import CatalogView from './CatalogView.vue';

const route = useRoute();
const router = useRouter();

const activeTab = computed<'media' | 'catalog'>({
  get() {
    return route.query.tab === 'catalog' ? 'catalog' : 'media';
  },
  set(val) {
    router.replace({
      query: { ...route.query, tab: val === 'catalog' ? 'catalog' : undefined },
    });
  },
});

function setTab(tab: 'media' | 'catalog') {
  activeTab.value = tab;
}
</script>

<style scoped>
.warehouse-view {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.warehouse-top-bar {
  background: rgb(var(--v-theme-surface));
}

.warehouse-icon-badge {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.15);
}

.warehouse-segmented-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  max-width: 100%;
  padding: 4px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  gap: 4px;
}

@media (max-width: 480px) {
  .warehouse-segmented-tabs {
    width: 100%;
  }
  .warehouse-tab-btn {
    flex: 1 1 0;
    justify-content: center;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.25;
    white-space: nowrap;
  }
}

.warehouse-tab-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
  user-select: none;
}

.warehouse-tab-btn:hover:not(.is-active) {
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.warehouse-tab-btn.is-active {
  color: #FFFFFF;
  background: rgb(var(--v-theme-primary));
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.3);
}

.warehouse-content {
  flex: 1;
}

/* Adjust child headers if needed for compact display */
:deep(.media-view-container),
:deep(.catalog-view) {
  padding-top: 16px !important;
}
</style>

