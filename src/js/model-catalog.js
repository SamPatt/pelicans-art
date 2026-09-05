(function initModelCatalog(global) {
  const providers = {
    openai: {
      label: 'OpenAI',
      description: 'The simplest single-provider setup for generation and optional voices.',
      keyUrl: 'https://platform.openai.com/api-keys',
      defaultModel: 'gpt-5.6-terra',
      models: [
        { id: 'gpt-6-astra', label: 'GPT-6 Astra', note: 'Flagship · highest cost in this shortlist' },
        { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', note: 'Recommended · balanced quality and cost' },
        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', note: 'Professional work · higher cost' },
        { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', note: 'Lower cost' }
      ]
    },
    openrouter: {
      label: 'OpenRouter',
      description: 'One key for models from several providers.',
      keyUrl: 'https://openrouter.ai/settings/keys',
      defaultModel: 'google/gemini-3.7-flash',
      models: [
        { id: 'openai/gpt-6-astra', label: 'GPT-6 Astra', note: 'Newest OpenAI flagship · highest quality and cost' },
        { id: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash', note: 'Recommended · fast multimodal model' },
        { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Higher quality · higher cost' },
        { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', note: 'Lower cost' }
      ]
    },
    anthropic: {
      label: 'Anthropic',
      description: 'Direct access to Claude models.',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      defaultModel: 'claude-sonnet-5',
      models: [
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Recommended · speed and intelligence' },
        { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Professional work · higher cost' },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Lower cost' }
      ]
    }
  };

  function getProvider(id) {
    return providers[id] || providers.openai;
  }

  function getModels(id) {
    return getProvider(id).models.slice();
  }

  function getDefaultModel(id) {
    return getProvider(id).defaultModel;
  }

  global.AITModelCatalog = { providers, getProvider, getModels, getDefaultModel };
})(window);
