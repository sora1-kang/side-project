import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import Home from "@/app/page";

vi.mock("@/components/toilet-finder", () => ({
  ToiletFinder: () => <div data-testid="finder" />,
}));

test("홈 화면은 제목과 화장실 찾기 화면을 보여준다", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 1, name: "가까운 공공화장실" })
  ).toBeInTheDocument();
  expect(screen.getByTestId("finder")).toBeInTheDocument();
});
