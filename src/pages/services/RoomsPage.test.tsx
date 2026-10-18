import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoomsPage from "./RoomsPage";

const apiMocks = vi.hoisted(() => ({
  buildings: vi.fn(),
  updateFavorite: vi.fn(),
  empty: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    room: {
      buildings: apiMocks.buildings,
      updateFavorite: apiMocks.updateFavorite,
      empty: apiMocks.empty,
    },
  },
}));

const buildings = [
  {
    building_id: "106",
    building_name: "综合楼",
    description: "可能无法查询到数据",
    favorite: true,
    last_query_at: "2026-10-03T09:20:00+08:00",
  },
  {
    building_id: "W134b2a60000WH",
    building_name: "综合楼机房",
    description: "可能无法查询到数据",
    favorite: true,
    last_query_at: "2026-10-05T18:10:00+08:00",
  },
  {
    building_id: "302",
    building_name: "研究生楼",
    description: null,
    favorite: false,
    last_query_at: "2026-10-04T14:35:00+08:00",
  },
  {
    building_id: "126",
    building_name: "南校区体育馆",
    description: "可能无法查询到数据",
    favorite: false,
    last_query_at: "2026-10-02T08:15:00+08:00",
  },
];

const firstRoom = {
  room_name: "综合楼机房 101",
  room_type: "多媒体教室",
  seat_count: 48,
  exam_seat_count: 30,
};

const secondRoom = {
  room_name: "综合楼机房 305",
  room_type: "普通教室",
  seat_count: 60,
  exam_seat_count: 45,
};

const roomResult = {
  time: 1,
  items: [firstRoom, secondRoom],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RoomsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("empty classroom page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.buildings.mockResolvedValue(buildings);
    apiMocks.updateFavorite.mockImplementation((buildingId: string, favorite: boolean) =>
      Promise.resolve({
        ...buildings.find((building) => building.building_id === buildingId)!,
        favorite,
      }),
    );
    apiMocks.empty.mockResolvedValue(roomResult);
  });

  it("loads and selects a described building before querying rooms", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("button", { name: "正在准备…" })).toBeDisabled();
    await waitFor(() => expect(apiMocks.buildings).toHaveBeenCalledOnce());
    expect(screen.getByRole("heading", { name: "筛选条件" })).toBeVisible();
    const filterForm = screen.getByRole("form", { name: "空教室筛选条件" });
    const filterCard = filterForm.querySelector(".room-filter-card");
    expect(filterCard).not.toBeNull();
    expect(filterCard?.querySelectorAll(".room-filter-field")).toHaveLength(2);
    expect(screen.queryByLabelText("节次")).not.toBeInTheDocument();
    expect(
      (await screen.findByRole("button", { name: "查询" })).closest(".room-filter-card"),
    ).toBeNull();

    const buildingField = screen.getByRole("button", { name: /教学楼，当前选择/ });
    await user.click(buildingField);

    const dialog = await screen.findByRole("dialog", { name: "选择教学楼" });
    expect(apiMocks.buildings).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByText("4 个可用楼栋")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("searchbox")).not.toBeInTheDocument();
    const favorites = within(dialog).getByRole("region", { name: "已收藏" });
    expect(within(favorites).getAllByRole("button", { name: /^选择/ })).toHaveLength(2);
    const buildingOption = within(dialog).getByRole("button", {
      name: "选择综合楼机房，可能无法查询到数据",
    });
    expect(buildingOption).toBeVisible();
    expect(within(buildingOption).getByText("可能无法查询到数据")).toBeVisible();
    expect(within(dialog).queryByText("W134b2a60000WH")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "选择研究生楼",
      }),
    ).toBeVisible();

    await user.click(buildingOption);
    expect(screen.queryByRole("dialog", { name: "选择教学楼" })).not.toBeInTheDocument();
    expect(buildingField).toHaveTextContent("综合楼机房");
    expect(buildingField).not.toHaveTextContent("W134b2a60000WH");
    expect(buildingField).toHaveAccessibleName("教学楼，当前选择：综合楼机房");

    await user.clear(screen.getByLabelText("日期"));
    await user.type(screen.getByLabelText("日期"), "2026-10-08");
    await user.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() =>
      expect(apiMocks.empty).toHaveBeenCalledWith("W134b2a60000WH", "2026-10-08", [1, 2]),
    );
    await waitFor(() => expect(apiMocks.buildings).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("综合楼机房 101")).toBeVisible();
    const resultHeading = screen.getByRole("heading", { name: "综合楼机房", level: 2 });
    expect(resultHeading).toBeVisible();
    expect(
      within(resultHeading.parentElement!).getByText("2026-10-08 星期四", { exact: true }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "查询结果" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "选择节次" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(apiMocks.empty).toHaveBeenCalledTimes(2));
  });

  it("queries the room list with a multi-select small-period sidebar", async () => {
    let resolveRooms!: (result: typeof roomResult) => void;
    apiMocks.empty
      .mockResolvedValueOnce(roomResult)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRooms = resolve;
        }),
      )
      .mockResolvedValue(roomResult);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "查询" }));
    const timeSelector = await screen.findByRole("group", { name: "选择节次" });
    const roomPanel = screen.getByRole("region", { name: "空教室列表" });
    expect(timeSelector).toHaveClass("surface");
    expect(roomPanel).toHaveClass("surface");
    expect(timeSelector.parentElement).not.toHaveClass("surface");
    expect(
      within(timeSelector)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "1-2 节，08:00-09:40",
      "3-4 节，10:00-11:40",
      "5-6 节，14:30-16:00",
      "7-8 节，16:10-17:40",
      "9-11 节，19:00-21:35",
      "12 节，21:35-22:20",
    ]);
    const firstPeriod = within(timeSelector).getByRole("button", {
      name: "1-2 节，08:00-09:40",
    });
    const secondPeriod = within(timeSelector).getByRole("button", {
      name: "3-4 节，10:00-11:40",
    });
    expect(firstPeriod).toHaveAttribute("aria-pressed", "true");
    expect(firstPeriod).toHaveAttribute("aria-disabled", "true");
    expect(secondPeriod).toHaveAttribute("aria-pressed", "false");
    expect(within(roomPanel).getByRole("list")).toBeVisible();
    expect(screen.getByText("综合楼机房 101")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "查询完成，已选第 1、2 节，共 2 间空教室。",
    );

    await user.click(firstPeriod);
    expect(apiMocks.empty).toHaveBeenCalledTimes(1);

    await user.click(secondPeriod);
    expect(secondPeriod).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(apiMocks.empty).toHaveBeenLastCalledWith(
        "W134b2a60000WH",
        expect.any(String),
        [1, 2, 3, 4],
      ),
    );
    expect(timeSelector).toBeVisible();
    expect(within(roomPanel).getByLabelText("正在加载")).toBeVisible();
    expect(screen.queryByText("综合楼机房 101")).not.toBeInTheDocument();
    resolveRooms({ time: 1, items: [secondRoom] });
    expect(await screen.findByText("综合楼机房 305")).toBeVisible();
    expect(screen.queryByText("综合楼机房 101")).not.toBeInTheDocument();

    await user.click(secondPeriod);
    await waitFor(() =>
      expect(apiMocks.empty).toHaveBeenLastCalledWith("W134b2a60000WH", expect.any(String), [1, 2]),
    );
    expect(firstPeriod).toHaveAttribute("aria-pressed", "true");
    expect(firstPeriod).toHaveAttribute("aria-disabled", "true");
    expect(secondPeriod).toHaveAttribute("aria-pressed", "false");
  });

  it("defaults to the most recently queried building", async () => {
    renderPage();

    const buildingField = await screen.findByRole("button", {
      name: "教学楼，当前选择：综合楼机房",
    });
    expect(buildingField).toHaveTextContent("综合楼机房");
    expect(buildingField).not.toHaveTextContent("W134b2a60000WH");
    const recent = screen.getByRole("group", { name: "最近查询的教学楼" });
    expect(within(recent).getByRole("button", { name: "综合楼机房" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers up to three recent building tags inside the building field", async () => {
    const user = userEvent.setup();
    renderPage();

    const recent = await screen.findByRole("group", { name: "最近查询的教学楼" });
    const buildingField = screen.getByRole("button", { name: /教学楼，当前选择/ });
    expect(buildingField.parentElement).toContainElement(recent);
    expect(recent.closest(".room-filter-card")).not.toBeNull();
    expect(
      within(recent)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["综合楼机房", "研究生楼", "综合楼"]);

    const recentBuilding = within(recent).getByRole("button", { name: "研究生楼" });
    await user.click(recentBuilding);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(buildingField).toHaveTextContent("研究生楼");
    expect(recentBuilding).toHaveAttribute("aria-pressed", "true");
    expect(recentBuilding.querySelector("svg")).not.toBeNull();

    await user.click(buildingField);
    const dialog = await screen.findByRole("dialog", { name: "选择教学楼" });
    const selectedOption = within(dialog).getByRole("button", { name: "选择研究生楼" });
    expect(selectedOption).toHaveAttribute("aria-pressed", "true");
    expect(selectedOption.querySelector("svg")).toBeNull();
  });

  it("omits the recent shortcut when the user has no query history", async () => {
    apiMocks.buildings.mockResolvedValue(
      buildings.map((building) => ({ ...building, last_query_at: null })),
    );
    renderPage();

    await waitFor(() => expect(apiMocks.buildings).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByLabelText("正在加载最近查询")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("group", { name: "最近查询的教学楼" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "教学楼，当前选择：综合楼" })).toHaveTextContent(
      "综合楼",
    );
  });

  it("shows only the available recent buildings when fewer than three exist", async () => {
    apiMocks.buildings.mockResolvedValue([
      { ...buildings[0], last_query_at: null },
      buildings[2],
      buildings[3],
    ]);
    renderPage();

    const recent = await screen.findByRole("group", { name: "最近查询的教学楼" });
    expect(within(recent).getAllByRole("button")).toHaveLength(2);
    expect(within(recent).getByRole("button", { name: "研究生楼" })).toBeVisible();
    expect(within(recent).getByRole("button", { name: "南校区体育馆" })).toBeVisible();
  });

  it("renders a single recent building without adding placeholders", async () => {
    apiMocks.buildings.mockResolvedValue(
      buildings.map((building) =>
        building.building_id === "302" ? building : { ...building, last_query_at: null },
      ),
    );
    renderPage();

    const recent = await screen.findByRole("group", { name: "最近查询的教学楼" });
    expect(within(recent).getAllByRole("button")).toHaveLength(1);
    expect(within(recent).getByRole("button", { name: "研究生楼" })).toBeVisible();
  });

  it("refreshes recent buildings after a successful room query", async () => {
    const refreshedBuildings = buildings.map((building) =>
      building.building_id === "302"
        ? { ...building, last_query_at: "2026-10-06T20:00:00+08:00" }
        : building,
    );
    apiMocks.buildings.mockResolvedValueOnce(buildings).mockResolvedValueOnce(refreshedBuildings);
    const user = userEvent.setup();
    renderPage();

    const recent = await screen.findByRole("group", { name: "最近查询的教学楼" });
    await user.click(within(recent).getByRole("button", { name: "研究生楼" }));
    await user.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => expect(apiMocks.buildings).toHaveBeenCalledTimes(2));
    expect(within(recent).getAllByRole("button")[0]).toHaveTextContent("研究生楼");
  });

  it("keeps a room-query failure local and retries it", async () => {
    apiMocks.empty
      .mockRejectedValueOnce(new Error("空教室查询失败"))
      .mockResolvedValueOnce(roomResult);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "查询" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("空教室查询失败");
    expect(screen.getByRole("heading", { name: "筛选条件" })).toBeVisible();
    expect(screen.getByRole("group", { name: "选择节次" })).toBeVisible();

    await user.click(within(error).getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("综合楼机房 101")).toBeVisible();
    expect(apiMocks.empty).toHaveBeenCalledTimes(2);
  });

  it("shows a local empty state when no rooms match every selected period", async () => {
    apiMocks.empty.mockResolvedValueOnce({ time: 1, items: [] });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "查询" }));

    expect(await screen.findByText("所选节次没有可用教室")).toBeVisible();
    expect(screen.getByText("可调整左侧节次重新查询。")).toBeVisible();
    expect(screen.getByRole("group", { name: "选择节次" })).toBeVisible();
  });

  it("moves favorites to the top of the building picker", async () => {
    const updatedBuildings = buildings.map((building) =>
      building.building_id === "W134b2a60000WH" ? { ...building, favorite: false } : building,
    );
    apiMocks.buildings.mockResolvedValue(updatedBuildings).mockResolvedValueOnce(buildings);
    let resolveFavorite!: (building: (typeof buildings)[number]) => void;
    apiMocks.updateFavorite.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFavorite = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /教学楼，当前选择/ }));
    const dialog = await screen.findByRole("dialog", { name: "选择教学楼" });
    const favorites = within(dialog).getByRole("region", { name: "已收藏" });
    const otherBuildings = within(dialog).getByRole("region", { name: "其他楼栋" });
    await user.click(within(favorites).getByRole("button", { name: "取消收藏综合楼机房" }));

    within(dialog)
      .getAllByRole("button", { name: /收藏/ })
      .forEach((button) => expect(button).toBeDisabled());
    await waitFor(() =>
      expect(apiMocks.updateFavorite).toHaveBeenCalledWith("W134b2a60000WH", false),
    );
    resolveFavorite(updatedBuildings[1]);
    const movedFavoriteButton = await within(otherBuildings).findByRole("button", {
      name: "收藏综合楼机房",
    });
    expect(
      within(otherBuildings).getByRole("button", {
        name: "选择综合楼机房，可能无法查询到数据",
      }),
    ).toBeVisible();
    expect(movedFavoriteButton).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(movedFavoriteButton).toHaveFocus());
  });

  it("keeps the building validation error inline and focuses the field", async () => {
    apiMocks.buildings.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "查询" }));

    expect(screen.getByText("请选择教学楼。")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /教学楼，当前选择/ })).toHaveFocus(),
    );
    expect(apiMocks.empty).not.toHaveBeenCalled();
  });

  it("contains a building-load failure and retries it inside the picker", async () => {
    const user = userEvent.setup();
    apiMocks.buildings.mockRejectedValueOnce(new Error("楼栋信息加载失败"));
    renderPage();

    await user.click(screen.getByRole("button", { name: /教学楼，当前选择/ }));
    const dialog = await screen.findByRole("dialog", { name: "选择教学楼" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("楼栋信息加载失败");
    expect(screen.getByLabelText("日期")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "重新加载" }));
    expect(await within(dialog).findByRole("region", { name: "已收藏" })).toBeVisible();
    expect(apiMocks.buildings).toHaveBeenCalledTimes(2);
  });
});
