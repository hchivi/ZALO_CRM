import { ref } from 'vue';

const isLoading = ref(false);
const loadingTitle = ref('Đang tải dữ liệu...');
const loadingSubtitle = ref('Vui lòng chờ trong giây lát');
let timer: any = null;
let minDisplayTimer: any = null;
let showTimestamp = 0;

export function useGlobalLoading() {
  function showLoading(title = 'Đang tải dữ liệu...', subtitle = 'Vui lòng chờ trong giây lát', delay = 0) {
    clearTimeout(timer);
    if (delay > 0) {
      timer = setTimeout(() => {
        loadingTitle.value = title;
        loadingSubtitle.value = subtitle;
        isLoading.value = true;
        showTimestamp = Date.now();
      }, delay);
    } else {
      loadingTitle.value = title;
      loadingSubtitle.value = subtitle;
      isLoading.value = true;
      showTimestamp = Date.now();
    }
  }

  function hideLoading(minDisplayMs = 200) {
    clearTimeout(timer);
    clearTimeout(minDisplayTimer);
    const elapsed = Date.now() - showTimestamp;
    if (isLoading.value && elapsed < minDisplayMs) {
      minDisplayTimer = setTimeout(() => {
        isLoading.value = false;
      }, minDisplayMs - elapsed);
    } else {
      isLoading.value = false;
    }
  }

  async function withLoading<T>(fn: () => Promise<T>, title?: string, subtitle?: string): Promise<T> {
    showLoading(title, subtitle);
    try {
      return await fn();
    } finally {
      hideLoading();
    }
  }

  return {
    isLoading,
    loadingTitle,
    loadingSubtitle,
    showLoading,
    hideLoading,
    withLoading,
  };
}

// Global window helpers so legacy or external calls work
if (typeof window !== 'undefined') {
  (window as any).showCrmLoading = (title?: string, subtitle?: string) => useGlobalLoading().showLoading(title, subtitle);
  (window as any).hideCrmLoading = () => useGlobalLoading().hideLoading();
}
