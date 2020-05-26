<script>
  import { onMount, onDestroy } from "svelte";
  import Article from "./Article.svelte";
  import { feeds, apiKey } from "./config.js";

  let loading = false;
  let feedName = "";
  let articles = null;
  let favouriteSet = false;  
  

  onMount(() => {
    const favourite = window.localStorage.getItem("favourite");
    if (favourite) {
      feedName = favourite;
      const feedURL = feeds[favourite];
      fetchFeedData(feedURL);
    }
  });

  function fetchFeedData(url) {
  	const myHeaders = new Headers();
    const myRequest = new Request(`${url}${apiKey}`, {
	  method: 'GET',
	  headers: myHeaders,
	  mode: 'cors',
	  cache: 'default',
	  origin: null
	});
	
    loading = true;
    fetch(myRequest)
      .then(response => response.json())
      .then(data => {
        loading = false;
        articles = data.articles;
      })
      .catch(err => console.log(err));
  }

  function changeFeed(evt) {
    evt.preventDefault();
    const feedURL = feeds[evt.target.value];
    feedName = evt.target.value;
    fetchFeedData(feedURL);
    window.localStorage.setItem("favourite", feedName);
  }
</script>

<style>
  .container {
    max-width: 768px;
    margin: 0 auto;
    padding: 0 0.5em;
    height: 100vh;
    position: relative;
    font-family: Arial, Helvetica, sans-serif;
  }

  footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.25em 0;
    text-align: center;
    background-color: #222;
    box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.26);
  }

  footer a {
    text-decoration: none;
    color: dodgerblue;
  }

  header {
    background-color: #222;
    padding: 0.7em 0;
    margin: 0 0 2em 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.26);
  }

  h1,
  h2 {
    font-weight: 400;
    text-align: center;
  }

  h1 {
    font-size: 2.25em;
    color: dodgerblue;
    padding: 0;
    margin: 0;
    letter-spacing: 0.05em;
  }

  h2 {
    font-size: 1.75em;
    margin: 1em 0;
  }

  .select-style {
    border: 1px solid #666;
    width: 190px;
    border-radius: 3px;
    overflow: hidden;
    margin: 0 auto;
  }

  .select-style select {
    font-size: 85%;
    padding: 5px 8px;
    width: 102%;
    border: none;
    box-shadow: none;
    background: transparent;
    background-image: none;
    -webkit-appearance: none;
    text-align-last: center;
  }

  .select-style select:focus {
    outline: none;
  }

  .loading {
    font-size: 125%;
    text-align: center;
    margin: 2em 0;
  }

  .back-to-top-link-container {
    text-align: center;
    margin: 2em 0 3.5em 0;
  }

  .back-to-top-link {
    text-decoration: none;
    font-size: 100%;
    padding: 0.25em 0.5em;
    border: 1px solid #666;
    border-radius: 5px;
    background-color: dodgerblue;
    color: white;
  }

  .back-to-top-link:hover {
    background-color: white;
    color: dodgerblue;
  }
</style>

<header>
  <h1 id="top">News Feeds</h1>
</header>
<main class="container">

  <div class="select-style">
    <label for="feeds">
      <select id="feeds" value="Message" on:change={changeFeed}>
        <option value="Message">Select a Feed</option>
        <option value="New Zealand">New Zealand</option>
        <option value="Australia">Australia</option>
        <option value="UK">UK</option>
        <option value="USA">USA</option>
        <option value="BBC">BBC</option>
        <option value="Singapore">Singapore</option>
        <option value="Reuters">Reuters</option>
        <option value="National Geographic">National Geographic</option>
      </select>
    </label>
  </div>

  {#if loading}
    <p class="loading">Loading...</p>
  {:else if feedName !== ''}
    <h2>{feedName}</h2>
  {/if}

  {#if articles !== null}
    {#each articles as article (article.title)}
      <Article {article} />
    {/each}
    <div class="back-to-top-link-container">
      <a class="back-to-top-link" href="#top">Back to Top</a>
    </div>
  {/if}

  <footer>
    <a target="_blank" href="https://newsapi.org/" rel="noopener noreferrer">
      Powered by NewsAPI.org
    </a>
  </footer>
</main>
