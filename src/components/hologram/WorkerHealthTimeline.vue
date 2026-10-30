<script setup lang="ts">
import type { VitalTimelineEvent } from '@/types/vitals'
import { formatVitalsUpdatedAt, vitalsLevelLabel } from '@/utils/vitalsFormat'

defineProps<{
  events: VitalTimelineEvent[]
}>()
</script>

<template>
  <ol class="timeline" aria-label="监测时间轴">
    <li v-for="event in events" :key="event.id" :class="`timeline__item--${event.level}`">
      <span>{{ formatVitalsUpdatedAt(event.at) }}</span>
      <strong>{{ event.label }}</strong>
      <em>{{ vitalsLevelLabel(event.level) }}</em>
    </li>
    <li v-if="events.length === 0" class="timeline__empty">暂无事件</li>
  </ol>
</template>

<style scoped lang="scss">
.timeline {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  overflow-y: hidden;
  pointer-events: auto;
  flex: 1;
  min-width: 0;
  height: 68px;
}

.timeline li {
  box-sizing: border-box;
  flex: 0 0 148px;
  width: 148px;
  height: 68px;
  min-height: 68px;
  padding: 8px 10px;
  border-left: 2px solid rgba(76, 201, 255, 0.45);
  background: rgba(6, 18, 32, 0.45);
  display: grid;
  align-content: start;
  gap: 2px;
  font-size: 11px;
  color: #8eb6d4;
  overflow: hidden;
}

.timeline__item--warning {
  border-left-color: #ffc86a;
}

.timeline__item--critical {
  border-left-color: #ff6b6b;
}

strong {
  color: #e8f6ff;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

em {
  font-style: normal;
  color: #6f91ab;
}

.timeline__empty {
  border-left-color: rgba(120, 160, 190, 0.2);
}
</style>
