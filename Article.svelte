<script>
  export let article;
</script>

<style>
  .article {
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.26);
    border-radius: 5px;
    margin-bottom: 1.25em;
    font-family: Arial, Helvetica, sans-serif;    
    line-height: 1.5;
    color: #222;
    background-color: #fcfcfc;
  }

  .article div {
    padding: 0.75em 1em;
  }

  .article a {
    text-decoration: none;
    cursor: pointer;
    color: dodgerblue;
    border-bottom: 2px solid transparent;
  }
  
  .article a:hover {    
    color: dodgerblue;   
    border-bottom-color: dodgerblue; 
    border-bottom-style: solid;
  }
</style>

<div class="article">
  {#if article.description}
    <div>
      {new Date(article.publishedAt).toLocaleDateString('en-NZ')}: {article.description}{' '}
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        Click or tap to read story
      </a>
    </div>
  {/if}
</div>
