<script>
  import { stores } from '@sapper/app'; // eslint-disable-line import/no-extraneous-dependencies
  import GAnalytics from 'ganalytics';
  import { onMount } from 'svelte';
  import Nav from '##/components/Nav.svelte';

  export let segment;

  const { page } = stores();
  let ga;

  $: ga && $page.path && ga.send('pageview');

  function sendError(event) {
    ga && ga.send('exception', { description: event.message });
  }

  onMount(() => {
    ga = new GAnalytics('G-QM3GJ5WTZ1', {
      aid: 1,
      an: 'MaxMilton.com',
      av: process.env.APP_VERSION,
    });

    ga.send('pageview');
  });
</script>

<svelte:window on:error="{sendError}" on:unhandledrejection="{sendError}" />

<Nav segment="{segment}" />

<main>
  <slot />
</main>

<footer class="footer tc">
  <a href="mailto:max@happycode.ltd" class="big" title="Contact Max">
    &#129492;
  </a>
</footer>
