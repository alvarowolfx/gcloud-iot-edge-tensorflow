// Copyright 2015-2017 Espressif Systems (Shanghai) PTE LTD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/event_groups.h"

#include "esp_camera.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "mdns.h"
#include "esp_event_loop.h"
#include "esp_log.h"
#include "esp_err.h"
#include "esp_http_server.h"
#include "nvs_flash.h"
#include "driver/gpio.h"

static esp_err_t jpg_http_handler(httpd_req_t *req);
static esp_err_t event_handler(void *ctx, system_event_t *event);
static void initialise_wifi(void);
static void start_mdns_service(void);

static const char *TAG = "camera_demo";

EventGroupHandle_t s_wifi_event_group;
static const int CONNECTED_BIT = BIT0;
static ip4_addr_t s_ip_addr;

#define CAMERA_PIXEL_FORMAT CAMERA_PF_JPEG
#if CONFIG_MODEL == CONFIG_MODEL_ESP32CAM
// #define CAMERA_FRAME_SIZE FRAMESIZE_UXGA // Full 2MP
#define CAMERA_FRAME_SIZE FRAMESIZE_SVGA // No PSRAM
#else
#define CAMERA_FRAME_SIZE FRAMESIZE_SVGA // No PSRAM
#endif

void app_main()
{

  esp_log_level_set("wifi", ESP_LOG_WARN);
  esp_log_level_set("gpio", ESP_LOG_WARN);
  esp_err_t err = nvs_flash_init();
  if (err != ESP_OK)
  {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ESP_ERROR_CHECK(nvs_flash_init());
  }

  camera_config_t camera_config = {
      .pin_reset = CONFIG_RESET,
      .pin_pwdn = CONFIG_PWDN,
      .pin_xclk = CONFIG_XCLK,
      .pin_sscb_sda = CONFIG_SDA,
      .pin_sscb_scl = CONFIG_SCL,

      .pin_d0 = CONFIG_D0,
      .pin_d1 = CONFIG_D1,
      .pin_d2 = CONFIG_D2,
      .pin_d3 = CONFIG_D3,
      .pin_d4 = CONFIG_D4,
      .pin_d5 = CONFIG_D5,
      .pin_d6 = CONFIG_D6,
      .pin_d7 = CONFIG_D7,
      .pin_vsync = CONFIG_VSYNC,
      .pin_href = CONFIG_HREF,
      .pin_pclk = CONFIG_PCLK,

      .xclk_freq_hz = CONFIG_XCLK_FREQ,
      .ledc_channel = LEDC_CHANNEL_0,
      .ledc_timer = LEDC_TIMER_0,

      .pixel_format = PIXFORMAT_JPEG,
      .frame_size = CAMERA_FRAME_SIZE,
      .jpeg_quality = 12,
      .fb_count = 1};

  err = esp_camera_init(&camera_config);
  if (err != ESP_OK)
  {
    ESP_LOGE(TAG, "Camera init failed with error 0x%x", err);
    return;
  }
  //    databuf = (char *) malloc(BUF_SIZE);
  initialise_wifi();

  start_mdns_service();

  httpd_handle_t server = NULL;
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  ESP_ERROR_CHECK(httpd_start(&server, &config));

  httpd_uri_t jpg_uri = {
      .uri = "/jpg",
      .method = HTTP_GET,
      .handler = jpg_http_handler,
      .user_ctx = NULL};

  ESP_ERROR_CHECK(httpd_register_uri_handler(server, &jpg_uri));
  ESP_LOGI(TAG, "Open http://" IPSTR "/jpg for single image/jpg image", IP2STR(&s_ip_addr));
  ESP_LOGI(TAG, "Free heap: %u", xPortGetFreeHeapSize());
  ESP_LOGI(TAG, "Camera demo ready");
}

typedef struct
{
  httpd_req_t *req;
  size_t len;
} jpg_chunking_t;

static size_t jpg_encode_stream(void *arg, size_t index, const void *data, size_t len)
{
  jpg_chunking_t *j = (jpg_chunking_t *)arg;
  if (!index)
  {
    j->len = 0;
  }
  if (httpd_resp_send_chunk(j->req, (const char *)data, len) != ESP_OK)
  {
    return 0;
  }
  j->len += len;
  return len;
}

esp_err_t jpg_http_handler(httpd_req_t *req)
{
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t fb_len = 0;
  int64_t fr_start = esp_timer_get_time();

  fb = esp_camera_fb_get();
  if (!fb)
  {
    ESP_LOGE(TAG, "Camera capture failed");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  res = httpd_resp_set_type(req, "image/jpeg");
  if (res == ESP_OK)
  {
    res = httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  }

  if (res == ESP_OK)
  {
    if (fb->format == PIXFORMAT_JPEG)
    {
      fb_len = fb->len;
      res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
    }
    else
    {
      jpg_chunking_t jchunk = {req, 0};
      res = frame2jpg_cb(fb, 80, jpg_encode_stream, &jchunk) ? ESP_OK : ESP_FAIL;
      httpd_resp_send_chunk(req, NULL, 0);
      fb_len = jchunk.len;
    }
  }
  esp_camera_fb_return(fb);
  int64_t fr_end = esp_timer_get_time();
  ESP_LOGI(TAG, "JPG: %uKB %ums", (uint32_t)(fb_len / 1024), (uint32_t)((fr_end - fr_start) / 1000));
  return res;
}

static esp_err_t event_handler(void *ctx, system_event_t *event)
{
  switch (event->event_id)
  {
  case SYSTEM_EVENT_STA_START:
    esp_wifi_connect();
    break;
  case SYSTEM_EVENT_STA_GOT_IP:
    xEventGroupSetBits(s_wifi_event_group, CONNECTED_BIT);
    s_ip_addr = event->event_info.got_ip.ip_info.ip;
    break;
  case SYSTEM_EVENT_STA_DISCONNECTED:
    esp_wifi_connect();
    xEventGroupClearBits(s_wifi_event_group, CONNECTED_BIT);
    break;
  default:
    break;
  }
  return ESP_OK;
}

void start_mdns_service()
{
  //initialize mDNS service
  esp_err_t err = mdns_init();
  if (err)
  {
    printf("MDNS Init failed: %d\n", err);
    return;
  }

  uint64_t chipId = 0LL;
  esp_efuse_mac_get_default((uint8_t *)(&chipId));
  char id[4];
  sprintf(id, "%04x", (uint16_t)(chipId >> 32));

  char name[18] = "indoor-camera-";
  strcat(name, id);

  mdns_hostname_set(name);
  mdns_service_add(NULL, "_camera", "_tcp", 80, NULL, 0);
  mdns_service_instance_name_set("_camera", "_tcp", name);

  ESP_LOGI(TAG, "MDNS domain: %s", name);
}

static void initialise_wifi(void)
{
  tcpip_adapter_init();
  s_wifi_event_group = xEventGroupCreate();
  ESP_ERROR_CHECK(esp_event_loop_init(event_handler, NULL));
  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&cfg));
  //    ESP_ERROR_CHECK( esp_wifi_set_storage(WIFI_STORAGE_RAM) );
  wifi_config_t wifi_config = {
      .sta = {
          .ssid = CONFIG_WIFI_SSID,
          .password = CONFIG_WIFI_PASSWORD,
      },
  };
  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
  ESP_ERROR_CHECK(esp_wifi_start());
  ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));
  ESP_LOGI(TAG, "Connecting to \"%s\"", wifi_config.sta.ssid);
  xEventGroupWaitBits(s_wifi_event_group, CONNECTED_BIT, false, true, portMAX_DELAY);
  ESP_LOGI(TAG, "Connected");
}
