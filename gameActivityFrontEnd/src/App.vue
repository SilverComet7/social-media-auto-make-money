<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>

  <router-view />
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: white;
}

#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
