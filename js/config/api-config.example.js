export const MEDIARK_LOCAL_CONFIG = {
  mode: "live",
  providers: {
    text_master: {
      baseUrl: "",
      apiKey: ""
    },
    text_reviewer: {
      baseUrl: "",
      apiKey: ""
    },
    image_main: {
      baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
      apiKey: "",
      model: "bytedance-seedream-5.0-lite",
      preferredVersion: "260128"
    },
    video_main: {
      baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
      apiKey: "",
      model: "seedance-1-5-pro-251215",
      targetProduct: "Seedance 2.0"
    }
  }
};
