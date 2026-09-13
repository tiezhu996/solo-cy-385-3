<template>
  <main>
    <header><h1>宝宝成长记录</h1><p>小满 10 个月 · 今日辅食 3 次</p></header>
    <section class="card inventory-entry">
      <div>
        <h2>辅食库存与消耗</h2>
        <p>按月龄为每个宝宝管理食材库存、到期日、低库存下限与喂食扣减记录</p>
      </div>
      <a class="entry-btn" href="/inventory/" target="_blank" rel="noopener">进入</a>
    </section>
    <section class="card">
      <h2>生长曲线</h2>
      <div ref="growthChart" class="chart"></div>
    </section>
    <section class="card">
      <h2>疫苗提醒</h2>
      <van-cell v-for="item in vaccines" :key="item.name" :title="item.name" :value="item.date"><template #label><van-tag :type="item.done ? 'success' : 'warning'">{{ item.done ? '已接种' : '待接种' }}</van-tag></template></van-cell>
    </section>
    <section class="card">
      <h2>辅食推荐</h2>
      <van-cell v-for="food in foods" :key="food" :title="food" value="适合 9-12 个月" />
    </section>
  </main>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as echarts from 'echarts';
const growthChart = ref<HTMLElement>();
const vaccines = [{ name: '麻腮风疫苗', date: '2026-06-18', done: false }, { name: '乙肝疫苗', date: '2026-04-10', done: true }];
const foods = ['南瓜米糊', '鳕鱼土豆泥', '苹果燕麦粥'];
onMounted(() => {
  const chart = echarts.init(growthChart.value!);
  chart.setOption({ legend: {}, xAxis: { data: ['6月','7月','8月','9月','10月'] }, yAxis: {}, series: [{ name: '体重kg', type: 'line', data: [7.5,7.9,8.2,8.6,9.1] }, { name: '身高cm', type: 'line', data: [66,68,70,72,74] }] });
});
</script>
