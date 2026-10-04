window.MANIFEST = {
  "today": "2026-10-10",
  "interactions": [
    {
      "id": "daily-guess",
      "label": "Daily: a missed guess (tile pop)",
      "times": [
        0,
        25,
        50,
        75,
        100,
        150,
        200,
        300
      ],
      "configs": [
        {
          "width": 375,
          "height": 812,
          "theme": "light",
          "before": "375-light-before.png",
          "after": "375-light-after.png",
          "frames": [
            {
              "t": 0,
              "file": "375-light-0.png"
            },
            {
              "t": 25,
              "file": "375-light-25.png"
            },
            {
              "t": 50,
              "file": "375-light-50.png"
            },
            {
              "t": 75,
              "file": "375-light-75.png"
            },
            {
              "t": 100,
              "file": "375-light-100.png"
            },
            {
              "t": 150,
              "file": "375-light-150.png"
            },
            {
              "t": 200,
              "file": "375-light-200.png"
            },
            {
              "t": 300,
              "file": "375-light-300.png"
            }
          ],
          "animations": {
            "names": [
              "pop",
              "pop"
            ],
            "end": 190,
            "latency": 67
          },
          "unstubbed": []
        },
        {
          "width": 375,
          "height": 812,
          "theme": "dark",
          "before": "375-dark-before.png",
          "after": "375-dark-after.png",
          "frames": [
            {
              "t": 0,
              "file": "375-dark-0.png"
            },
            {
              "t": 25,
              "file": "375-dark-25.png"
            },
            {
              "t": 50,
              "file": "375-dark-50.png"
            },
            {
              "t": 75,
              "file": "375-dark-75.png"
            },
            {
              "t": 100,
              "file": "375-dark-100.png"
            },
            {
              "t": 150,
              "file": "375-dark-150.png"
            },
            {
              "t": 200,
              "file": "375-dark-200.png"
            },
            {
              "t": 300,
              "file": "375-dark-300.png"
            }
          ],
          "animations": {
            "names": [
              "pop",
              "pop"
            ],
            "end": 190,
            "latency": 49
          },
          "unstubbed": []
        },
        {
          "width": 1024,
          "height": 768,
          "theme": "light",
          "before": "1024-light-before.png",
          "after": "1024-light-after.png",
          "frames": [
            {
              "t": 0,
              "file": "1024-light-0.png"
            },
            {
              "t": 25,
              "file": "1024-light-25.png"
            },
            {
              "t": 50,
              "file": "1024-light-50.png"
            },
            {
              "t": 75,
              "file": "1024-light-75.png"
            },
            {
              "t": 100,
              "file": "1024-light-100.png"
            },
            {
              "t": 150,
              "file": "1024-light-150.png"
            },
            {
              "t": 200,
              "file": "1024-light-200.png"
            },
            {
              "t": 300,
              "file": "1024-light-300.png"
            }
          ],
          "animations": {
            "names": [
              "pop",
              "pop"
            ],
            "end": 190,
            "latency": 42
          },
          "unstubbed": []
        },
        {
          "width": 1024,
          "height": 768,
          "theme": "dark",
          "before": "1024-dark-before.png",
          "after": "1024-dark-after.png",
          "frames": [
            {
              "t": 0,
              "file": "1024-dark-0.png"
            },
            {
              "t": 25,
              "file": "1024-dark-25.png"
            },
            {
              "t": 50,
              "file": "1024-dark-50.png"
            },
            {
              "t": 75,
              "file": "1024-dark-75.png"
            },
            {
              "t": 100,
              "file": "1024-dark-100.png"
            },
            {
              "t": 150,
              "file": "1024-dark-150.png"
            },
            {
              "t": 200,
              "file": "1024-dark-200.png"
            },
            {
              "t": 300,
              "file": "1024-dark-300.png"
            }
          ],
          "animations": {
            "names": [
              "pop",
              "pop"
            ],
            "end": 190,
            "latency": 40
          },
          "unstubbed": []
        }
      ]
    },
    {
      "id": "screen-change",
      "label": "Screen change: Daily to History (view transition)",
      "times": [
        0,
        25,
        50,
        75,
        100,
        150
      ],
      "configs": [
        {
          "width": 375,
          "height": 812,
          "theme": "light",
          "before": "375-light-before.png",
          "after": "375-light-after.png",
          "frames": [
            {
              "t": 0,
              "file": "375-light-0.png"
            },
            {
              "t": 25,
              "file": "375-light-25.png"
            },
            {
              "t": 50,
              "file": "375-light-50.png"
            },
            {
              "t": 75,
              "file": "375-light-75.png"
            },
            {
              "t": 100,
              "file": "375-light-100.png"
            },
            {
              "t": 150,
              "file": "375-light-150.png"
            }
          ],
          "animations": {
            "names": [
              "rise::view-transition-new(screen)",
              "rise::view-transition-new(switcher-content)"
            ],
            "end": 150,
            "latency": 59
          },
          "unstubbed": []
        },
        {
          "width": 375,
          "height": 812,
          "theme": "dark",
          "before": "375-dark-before.png",
          "after": "375-dark-after.png",
          "frames": [
            {
              "t": 0,
              "file": "375-dark-0.png"
            },
            {
              "t": 25,
              "file": "375-dark-25.png"
            },
            {
              "t": 50,
              "file": "375-dark-50.png"
            },
            {
              "t": 75,
              "file": "375-dark-75.png"
            },
            {
              "t": 100,
              "file": "375-dark-100.png"
            },
            {
              "t": 150,
              "file": "375-dark-150.png"
            }
          ],
          "animations": {
            "names": [
              "rise::view-transition-new(screen)",
              "rise::view-transition-new(switcher-content)"
            ],
            "end": 150,
            "latency": 62
          },
          "unstubbed": []
        },
        {
          "width": 1024,
          "height": 768,
          "theme": "light",
          "before": "1024-light-before.png",
          "after": "1024-light-after.png",
          "frames": [
            {
              "t": 0,
              "file": "1024-light-0.png"
            },
            {
              "t": 25,
              "file": "1024-light-25.png"
            },
            {
              "t": 50,
              "file": "1024-light-50.png"
            },
            {
              "t": 75,
              "file": "1024-light-75.png"
            },
            {
              "t": 100,
              "file": "1024-light-100.png"
            },
            {
              "t": 150,
              "file": "1024-light-150.png"
            }
          ],
          "animations": {
            "names": [
              "rise::view-transition-new(screen)",
              "rise::view-transition-new(switcher-content)"
            ],
            "end": 150,
            "latency": 59
          },
          "unstubbed": []
        },
        {
          "width": 1024,
          "height": 768,
          "theme": "dark",
          "before": "1024-dark-before.png",
          "after": "1024-dark-after.png",
          "frames": [
            {
              "t": 0,
              "file": "1024-dark-0.png"
            },
            {
              "t": 25,
              "file": "1024-dark-25.png"
            },
            {
              "t": 50,
              "file": "1024-dark-50.png"
            },
            {
              "t": 75,
              "file": "1024-dark-75.png"
            },
            {
              "t": 100,
              "file": "1024-dark-100.png"
            },
            {
              "t": 150,
              "file": "1024-dark-150.png"
            }
          ],
          "animations": {
            "names": [
              "rise::view-transition-new(screen)",
              "rise::view-transition-new(switcher-content)"
            ],
            "end": 150,
            "latency": 52
          },
          "unstubbed": []
        }
      ]
    }
  ]
};
