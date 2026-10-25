/**
 * Mocks for Naive UI components that are globally registered in the app.
 *
 * The mocks stay minimal on purpose: a button is a button and a container is
 * a div. `NInput` and `NSelect` are the exceptions — a spec drives them
 * through the native `input`/`change` events of the element they render, so
 * they have to expose a real form element.
 *
 * A mock never declares every prop the real component declares, so the rest
 * arrives as attrs. They fall through to the element the mock renders, which
 * is what a real component does with the ones it does not own — and it is
 * what carries a `data-testid` to the DOM.
 */
import { h } from "vue";

const FORM_PROPS = [
  "type", "size", "secondary", "dashed", "weak", "strong", "tertiary", "quaternary",
  "ghost", "circle", "block", "loading", "disabled", "onClick", "value", "placeholder",
  "clearable", "multiline", "autosize", "rows", "maxlength", "readonly", "name", "id",
  "status", "text", "style", "class", "themeOverrides", "options", "placement",
  "inputProps", "consistentMenuWidth", "filterable", "tag", "onUpdateValue", "onUpdate:value",
];

// Generic mock component that renders its slot and props as a button.
const createMockComponent = (name) => ({
  name,
  inheritAttrs: false,
  props: FORM_PROPS,
  setup(props, { slots, emit, attrs }) {
    return () =>
      h("button", {
        class: `naive-${name.toLowerCase()}`,
        ...attrs,
        // The click handler sits on the element as an attr, so an explicit
        // onClick here would be the SECOND handler of the same click.
        type: props.type,
        disabled: props.disabled,
        onClick: (e) => {
          emit("click", e);
        },
      }, slots.default?.());
  },
});

// Container mock: renders its slot in a div so a spec can find what is
// inside without the component hiding it behind a button.
const createContainerComponent = (name) => ({
  name,
  inheritAttrs: false,
  props: FORM_PROPS,
  setup(props, { slots, attrs }) {
    return () => h("div", { class: `naive-${name.toLowerCase()}`, ...attrs }, slots.default?.());
  },
});

const emitValue = (emit, props, value) => {
  if (typeof props.onUpdateValue === "function") props.onUpdateValue(value);
  if (typeof props["onUpdate:value"] === "function") props["onUpdate:value"](value);
  emit("update:value", value);
  emit("updateValue", value);
};

// A real input: the spec writes into the element and dispatches the native
// events a browser would send, so the mock has to listen for them.
export const NInput = {
  name: "NInput",
  inheritAttrs: false,
  props: FORM_PROPS,
  setup(props, { emit, attrs }) {
    return () =>
      h(props.type === "textarea" ? "textarea" : "input", {
        ...attrs,
        // The class of the caller comes first, so that the class of the mock
        // does not hide it: a spec looks for the class of the component it
        // drives, not for the class of the mock. The class is a declared prop
        // of the mock, so it does not arrive in the attrs.
        class: [props.class, "naive-ninput"],
        value: props.value,
        placeholder: props.placeholder,
        readonly: props.readonly,
        maxlength: props.maxlength,
        rows: props.type === "textarea" ? props.rows : undefined,
        onInput: (e) => emitValue(emit, props, e.target.value),
        onChange: (e) => {
          emitValue(emit, props, e.target.value);
          emit("change", e.target.value);
        },
        onBlur: (e) => {
          if (typeof props.onBlur === "function") props.onBlur(e);
          emit("blur", e);
        },
        onKeyup: (e) => {
          emit("keyup", e);
          if (e.key === "Enter") emit("keyup:enter", e);
        },
      });
  },
};

// A real select: the spec picks an option, so the mock renders the options.
export const NSelect = {
  name: "NSelect",
  inheritAttrs: false,
  props: FORM_PROPS,
  setup(props, { emit, attrs }) {
    return () =>
      h("select", {
        class: "naive-nselect",
        ...attrs,
        value: props.value,
        onChange: (e) => emitValue(emit, props, e.target.value),
      }, (props.options ?? []).map((option) =>
        h("option", { value: option.value, key: option.value }, option.label)));
  },
};

export const NButton = createMockComponent("NButton");
export const NTag = createMockComponent("NTag");

// NCheckbox mock: handles the `checked` prop and emits `update:checked` on click.
export const NCheckbox = {
  name: "NCheckbox",
  inheritAttrs: false,
  props: [...FORM_PROPS, "checked"],
  emits: ["update:checked", "click"],
  setup(props, { emit, slots, attrs }) {
    return () =>
      h("input", {
        type: "checkbox",
        class: "naive-ncheckbox",
        ...attrs,
        checked: props.checked,
        onChange: (e) => {
          emit("update:checked", e.target.checked);
        },
        // The click handler sits on the element as an attr, so an explicit
        // onClick here would be the SECOND handler of the same click.
        onClick: (e) => {
          emit("click", e);
          // Toggle the checkbox state on click
          emit("update:checked", !props.checked);
        },
      });
  },
};

export const NSwitch = createMockComponent("NSwitch");
export const NEmpty = createMockComponent("NEmpty");
export const NIcon = createMockComponent("NIcon");
export const NTooltip = createContainerComponent("NTooltip");
export const NDropdown = createMockComponent("NDropdown");
export const NPopconfirm = createMockComponent("NPopconfirm");
export const NPopselect = createMockComponent("NPopselect");
export const NInputNumber = createMockComponent("NInputNumber");
export const NRadio = createMockComponent("NRadio");
export const NRadioButton = createMockComponent("NRadioButton");
export const NRadioGroup = createContainerComponent("NRadioGroup");
export const NForm = createContainerComponent("NForm");
export const NFormItem = createContainerComponent("NFormItem");
export const NSpace = createContainerComponent("NSpace");
export const NDivider = createContainerComponent("NDivider");
export const NCollapse = createContainerComponent("NCollapse");
export const NCollapseItem = createContainerComponent("NCollapseItem");
export const NModal = createContainerComponent("NModal");
export const NCard = createContainerComponent("NCard");
export const NText = createContainerComponent("NText");
export const NH1 = createContainerComponent("NH1");
export const NH2 = createContainerComponent("NH2");
export const NH3 = createContainerComponent("NH3");
export const NH4 = createContainerComponent("NH4");
export const NH5 = createContainerComponent("NH5");
export const NH6 = createContainerComponent("NH6");
export const NP = createContainerComponent("NP");
export const NUl = createContainerComponent("NUl");
export const NOl = createContainerComponent("NOl");
export const NLi = createContainerComponent("NLi");
export const NBlockquote = createContainerComponent("NBlockquote");
export const NCode = createContainerComponent("NCode");
export const NPre = createContainerComponent("NPre");
export const NSpin = createContainerComponent("NSpin");
export const NSkeleton = createMockComponent("NSkeleton");
export const NScrollbar = createContainerComponent("NScrollbar");
export const NMenu = createContainerComponent("NMenu");
export const NTabs = createContainerComponent("NTabs");
export const NTabPane = createContainerComponent("NTabPane");
export const NDataTable = createContainerComponent("NDataTable");
export const NTable = createContainerComponent("NTable");
export const NTh = createContainerComponent("NTh");
export const NTd = createContainerComponent("NTd");
export const NThead = createContainerComponent("NThead");
export const NTbody = createContainerComponent("NTbody");
export const NTr = createContainerComponent("NTr");
export const NUpload = createContainerComponent("NUpload");
export const NUploadDragger = createContainerComponent("NUploadDragger");
export const NProgress = createMockComponent("NProgress");
export const NRate = createMockComponent("NRate");
export const NGradientText = createContainerComponent("NGradientText");
export const NAvatar = createMockComponent("NAvatar");
export const NAvatarGroup = createContainerComponent("NAvatarGroup");
export const NBadge = createMockComponent("NBadge");
export const NCircularProgress = createMockComponent("NCircularProgress");
export const NCountdown = createMockComponent("NCountdown");
export const NDynamicInput = createContainerComponent("NDynamicInput");
export const NDynamicTags = createContainerComponent("NDynamicTags");
export const NElement = createContainerComponent("NElement");
export const NGi = createContainerComponent("NGi");
export const NGrid = createContainerComponent("NGrid");
export const NGridItem = createContainerComponent("NGridItem");
export const NLayout = createContainerComponent("NLayout");
export const NLayoutContent = createContainerComponent("NLayoutContent");
export const NLayoutFooter = createContainerComponent("NLayoutFooter");
export const NLayoutHeader = createContainerComponent("NLayoutHeader");
export const NLayoutSider = createContainerComponent("NLayoutSider");
export const NList = createContainerComponent("NList");
export const NListItem = createContainerComponent("NListItem");
export const NLog = createContainerComponent("NLog");
export const NNumberAnimation = createMockComponent("NNumberAnimation");
export const NQuotationMark = createMockComponent("NQuotationMark");
export const NResult = createContainerComponent("NResult");
export const NRow = createContainerComponent("NRow");
export const NCol = createContainerComponent("NCol");
export const NSegmented = createContainerComponent("NSegmented");
export const NDescriptions = createContainerComponent("NDescriptions");
export const NDescriptionsItem = createContainerComponent("NDescriptionsItem");
export const NStatistic = createContainerComponent("NStatistic");
export const NTime = createMockComponent("NTime");
export const NTimeline = createContainerComponent("NTimeline");
export const NTimelineItem = createContainerComponent("NTimelineItem");
export const NWatermark = createContainerComponent("NWatermark");
// NButtonGroup must not be a button itself: it wraps the toolbar buttons, and
// a mock button would swallow their click.
export const NButtonGroup = createContainerComponent("NButtonGroup");

// NConfigProvider and NGlobalStyle mount the theme and the styles of the
// library. The editor renders them, so a spec that mounts the editor without
// the plugin of the library would warn about two components it cannot
// resolve. The provider renders its slot and the style renders nothing.
export const NConfigProvider = createContainerComponent("NConfigProvider");
export const NGlobalStyle = createMockComponent("NGlobalStyle");

// VueDraggable mock: renders a div with the default slot, emits "end" on demand.
export const VueDraggable = {
  name: "VueDraggable",
  inheritAttrs: false,
  props: ["modelValue", "tag", "itemKey", "handle", "animation", "ghostClass"],
  emits: ["update:modelValue", "end", "start", "change"],
  setup(props, { emit, slots, attrs }) {
    return () =>
      h("div", {
        class: "mock-vuedraggable",
        ...attrs,
        "data-testid": "vue-draggable",
      }, slots.default?.());
  },
};

const REGISTRY = {
  NButton, NInput, NSelect, NTag, NCheckbox, NSwitch, NEmpty, NIcon, NTooltip,
  NDropdown, NPopconfirm, NPopselect, NInputNumber, NRadio, NRadioButton,
  NRadioGroup, NForm, NFormItem, NSpace, NDivider, NCollapse, NCollapseItem,
  NModal, NCard, NText, NH1, NH2, NH3, NH4, NH5, NH6, NP, NUl, NOl, NLi,
  NBlockquote, NCode, NPre, NSpin, NSkeleton, NScrollbar, NMenu, NTabs,
  NTabPane, NDataTable, NTable, NTh, NTd, NThead, NTbody, NTr, NUpload,
  NUploadDragger, NProgress, NRate, NGradientText, NAvatar, NAvatarGroup,
  NBadge, NCircularProgress, NCountdown, NDynamicInput, NDynamicTags,
  NElement, NGi, NGrid, NGridItem, NLayout, NLayoutContent, NLayoutFooter,
  NLayoutHeader, NLayoutSider, NList, NListItem, NLog, NNumberAnimation,
  NQuotationMark, NResult, NRow, NCol, NSegmented, NDescriptions,
  NDescriptionsItem, NStatistic, NTime, NTimeline, NTimelineItem, NWatermark,
  NButtonGroup, NConfigProvider, NGlobalStyle,
};

// Naive UI plugin mock
export const naive = {
  install(app) {
    for (const [name, component] of Object.entries(REGISTRY)) {
      app.component(name, component);
    }
    app.component("VueDraggable", VueDraggable);
  },
};

