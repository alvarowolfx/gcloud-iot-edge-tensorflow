from object_detection.utils import visualization_utils as vis_util
from object_detection.utils import label_map_util
from keras.preprocessing import image
import cv2
from PIL import Image
from matplotlib import pyplot as plt
from io import StringIO
from collections import defaultdict
import zipfile
import tensorflow as tf
import time
import sys
import numpy as np
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'


#MODEL_NAME = 'ssd_mobilenet_v1_coco_11_06_2017'
OBJECT_DETECTION_MODEL_NAME = 'ssd_mobilenet_v1_coco_11_06_2017'
OBJECT_DETECTION_PATH_TO_CKPT = OBJECT_DETECTION_MODEL_NAME + \
    '/frozen_inference_graph.pb'
OBJECT_DETECTION_PATH_TO_LABELS = os.path.join(
    OBJECT_DETECTION_MODEL_NAME, 'graph.pbtxt')
OBJECT_DETECTION_NUM_CLASSES = 90

MODEL_NAME = 'model'
PATH_TO_CKPT = MODEL_NAME + '/cats_model.pb'
PATH_TO_LABELS = os.path.join(MODEL_NAME, 'graph.pbtxt')
NUM_CLASSES = 5


PATH_TO_TEST_IMAGES_DIR = 'test_images'
TEST_IMAGE_PATHS = [os.path.join(
    PATH_TO_TEST_IMAGES_DIR, 'image{}.jpg'.format(i)) for i in range(1, 7)]

# Size, in inches, of the output images.
IMAGE_SIZE = (12, 8)


def load_image_into_numpy_array(image):
    (im_width, im_height) = image.size
    return np.array(image.getdata()).reshape(
        (im_height, im_width, 3)).astype(np.uint8)


def draw_boxes_with_class(image, boxes, classes, scores):
    vis_util.visualize_boxes_and_labels_on_image_array(
        image,
        np.squeeze(boxes),
        np.squeeze(classes).astype(np.int32),
        np.squeeze(scores),
        category_index,
        use_normalized_coordinates=True,
        line_thickness=8)
    return image


def image_resize(image, width=None, height=None, inter=cv2.INTER_AREA):
    # initialize the dimensions of the image to be resized and
    # grab the image size
    dim = None
    (h, w) = image.shape[:2]

    # if both the width and height are None, then return the
    # original image
    if width is None and height is None:
        return image

    # check to see if the width is None
    if width is None:
        # calculate the ratio of the height and construct the
        # dimensions
        r = height / float(h)
        dim = (int(w * r), height)

    # otherwise, the height is None
    else:
        # calculate the ratio of the width and construct the
        # dimensions
        r = width / float(w)
        dim = (width, int(h * r))

    # resize the image
    resized = cv2.resize(image, dim, interpolation=inter)

    # return the resized image
    return resized


def classify_image(frame, sess, graph):
    img_tensor = image.img_to_array(frame)
    # print(frame, img_tensor)
    img_tensor = np.expand_dims(img_tensor, axis=0)
    img_tensor /= 255.
    # print(frame, img_tensor)
    image_tensor = graph.get_tensor_by_name('input_4:0')
    classes = graph.get_tensor_by_name('dense_12/Softmax:0')
    (classes) = sess.run(
        [classes],
        feed_dict={image_tensor: img_tensor})
    local_classes = np.squeeze(classes)
    min_score_thresh = .5
    # print('classify image, found ', local_classes)
    classes = []
    for i in range(len(local_classes)):
        score = local_classes[i]
        if score > min_score_thresh:
            class_name = cats_category_index[i+1]['name']
            print('found ', i, class_name, score)
            classes.append((class_name, score))
    return classes


def detect_objects(frame, sess, detection_graph):
    # Expand dimensions since the model expects images to have shape: [1, None, None, 3]
    image_np_expanded = np.expand_dims(frame, axis=0)
    image_tensor = detection_graph.get_tensor_by_name('image_tensor:0')
    # Each box represents a part of the image where a particular object was detected.
    boxes = detection_graph.get_tensor_by_name('detection_boxes:0')
    # Each score represent how level of confidence for each of the objects.
    # Score is shown on the result image, together with the class label.
    scores = detection_graph.get_tensor_by_name('detection_scores:0')
    classes = detection_graph.get_tensor_by_name('detection_classes:0')
    num_detections = detection_graph.get_tensor_by_name(
        'num_detections:0')
    # Actual detection.
    (boxes, scores, classes, num_detections) = sess.run(
        [boxes, scores, classes, num_detections],
        feed_dict={image_tensor: image_np_expanded})

    min_score_thresh = .5
    im_width = image_np_expanded.shape[2]
    im_height = image_np_expanded.shape[1]
    local_boxes = np.squeeze(boxes)
    local_classes = np.squeeze(classes).astype(np.int32)
    local_scores = np.squeeze(scores)
    for i in range(local_boxes.shape[0]):
        if local_scores[i] > min_score_thresh:
            box = tuple(local_boxes[i].tolist())
            class_name = 'N/A'
            if local_classes[i] in category_index.keys():
                class_name = category_index[local_classes[i]]['name']

            if(class_name == 'cat'):
                print('found a cat', box)
                ymin, xmin, ymax, xmax = box
                (xminn, xmaxx, yminn, ymaxx) = (xmin * im_width,
                                                xmax * im_width,
                                                ymin * im_height,
                                                ymax * im_height)
                print('found a cat', xminn, xmaxx, yminn, ymaxx)
                # crop_img = tf.image.crop_to_bounding_box(frame,int(yminn), int(xminn), int(ymaxx-yminn), int(xmaxx-xminn))
                crop_img = frame[int(yminn):int(ymaxx), int(xminn):int(xmaxx)]
                # cv2.imshow("Found a Cat", crop_img)
                findings = classify_image(crop_img, classification_sess,
                                          classification_graph)
                for item in findings:
                    cv2.imshow("Found a Cat: " + item[0], crop_img)

    # Visualization of the results of a detection.
    # print scores, classes, num_detections
    frame = draw_boxes_with_class(frame, boxes, classes, scores)
    return frame


start_time = time.time()

label_map = label_map_util.load_labelmap(OBJECT_DETECTION_PATH_TO_LABELS)
categories = label_map_util.convert_label_map_to_categories(
    label_map, max_num_classes=OBJECT_DETECTION_NUM_CLASSES, use_display_name=True)
category_index = label_map_util.create_category_index(categories)

cats_label_map = label_map_util.load_labelmap(PATH_TO_LABELS)
cats_categories = label_map_util.convert_label_map_to_categories(
    cats_label_map, max_num_classes=NUM_CLASSES, use_display_name=True)
cats_category_index = label_map_util.create_category_index(cats_categories)

detection_graph = tf.Graph()
with detection_graph.as_default():
    od_graph_def = tf.GraphDef()
    with tf.gfile.GFile(OBJECT_DETECTION_PATH_TO_CKPT, 'rb') as fid:
        serialized_graph = fid.read()
        od_graph_def.ParseFromString(serialized_graph)
        tf.import_graph_def(od_graph_def, name='')

    sess = tf.Session(graph=detection_graph)

classification_graph = tf.Graph()
with classification_graph.as_default():
    od_graph_def = tf.GraphDef()
    with tf.gfile.GFile(PATH_TO_CKPT, 'rb') as fid:
        serialized_graph = fid.read()
        od_graph_def.ParseFromString(serialized_graph)
        tf.import_graph_def(od_graph_def, name='')

    classification_sess = tf.Session(graph=classification_graph)


print("--- %s seconds for initialization ---" % (time.time() - start_time))

'''
for image_path in TEST_IMAGE_PATHS:
    start_time = time.time()
    image = Image.open(image_path)
    # the array based representation of the image will be used later in order to prepare the
    # result image with boxes and labels on it.
    image_np = load_image_into_numpy_array(image)
    image_np = detect_objects(image_np, sess, detection_graph)
    # plt.figure(figsize=IMAGE_SIZE)
    # plt.imgshow(image_np)
    print("--- %s seconds for image %s---" %
          (time.time() - start_time, image_path))
    cv2.imshow(image_path, image_np)

cv2.waitKey(0)
cv2.destroyAllWindows()
'''

cap = cv2.VideoCapture(0)

while(True):
    # Capture frame-by-frame
    ret, frame = cap.read()
    proportion = 0.5
    small = cv2.resize(frame, (0, 0), fx=proportion, fy=proportion)
    # small = image_resize(frame, height=300)
    # (h, w) = small.shape[:2]
    # y = 0
    # x = round((w-300)/2)
    # h = 300
    # w = 300
    # print(h, w, x, y)
    # small = small[y:y+h, x:x+w]
    # small = img[y:y+h, x:x+w]

    # Our operations on the frame come here
    # gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    start_time = time.time()
    image_with_box = detect_objects(small, sess, detection_graph)
    # print("--- %s seconds for frame ---" % (time.time() - start_time))
    # Display the resulting frame
    cv2.imshow('frame', image_with_box)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# When everything done, release the capture
cap.release()
cv2.destroyAllWindows()
