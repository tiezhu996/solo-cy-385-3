import { createApp } from 'vue';
import { Button, Cell, CellGroup, Tag } from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import './styles.css';

createApp(App).use(Button).use(Cell).use(CellGroup).use(Tag).mount('#app');
